"""What each chosen ETF holds, from its latest regulator filing or manager file.

The caller picks the ETFs — the scheduled run takes the ones in some portfolio,
which is portfolio knowledge and is decided in the portfolio module. Each ETF
is one attempt: its latest report is found, skipped when it is the one already
stored, and otherwise read and written in one transaction.

An American ETF is read from its N-PORT. A UCITS fund files no holdings with
any regulator, so it is read from its manager's file when
`MANAGER_HOLDINGS_FILES` names one for its class, and otherwise is said to
have no source in the run instead of failing it.
"""

import asyncio
from collections.abc import Callable, Sequence
from datetime import UTC, datetime

from app.config.logger import logger
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.integrations.dws_client import PROVIDER as DWS_PROVIDER
from app.infra.integrations.dws_client import DwsClient
from app.infra.integrations.openfigi_client import PROVIDER as FIGI_PROVIDER
from app.infra.integrations.openfigi_client import OpenFigiClient
from app.infra.integrations.sec_client import PROVIDER, SecClient
from app.modules.market_data.adapters.etf_filings import read_nport_document
from app.modules.market_data.adapters.etf_manager_files import read_dws_constituents
from app.modules.market_data.domain.etf_registry import EtfHoldingSource, holdings_source
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.market_data.domain.market_scope import is_brazilian_market
from app.modules.market_data.service.data_ingestion_service import DataIngestionService

#: How many tickers a report names, past the counts.
REPORT_SAMPLE = 200


class EtfHoldingsIngestionService:
    def __init__(
        self,
        *,
        uow_factory: Callable[[], UnitOfWork],
        ingestion_service: DataIngestionService,
        sec: SecClient,
        figi: OpenFigiClient,
        dws: DwsClient,
    ):
        self.uow_factory = uow_factory
        self.ingestion_service = ingestion_service
        self.sec = sec
        self.figi = figi
        self.dws = dws

    async def run(
        self,
        *,
        asset_ids: Sequence[int] | None = None,
        execution_id: int | None = None,
        selection_parameters: dict | None = None,
    ) -> int | None:
        prepared = await self.ingestion_service.prepare_execution(
            ingestion_type=DataIngestionType.ETF_HOLDINGS,
            execution_id=execution_id,
            force_full_history=False,
        )
        if prepared is None:
            return execution_id
        current_execution_id, _, requested_ids = prepared
        try:
            chosen = list(requested_ids or asset_ids or [])
            async with self.uow_factory() as uow:
                linked = await uow.etf_registry.get_linked_funds(chosen)
            sourced = [
                (asset_id, ticker, fund, isin, holdings_source(fund, isin))
                for asset_id, ticker, fund, isin in linked
            ]
            with_source = [item for item in sourced if item[4] is not None]
            await self.ingestion_service.set_execution_items(
                current_execution_id,
                item_ids=[item[0] for item in with_source],
                parameters={
                    **(selection_parameters or {'selection': 'explicit_asset_ids'}),
                    'item_ids': chosen,
                    # A UCITS fund files no holdings with a regulator, and not
                    # every manager's file is read; one without a registered
                    # class has nothing to ask for.
                    'without_source': sorted(
                        ticker for _, ticker, _, _, source in sourced if source is None
                    ),
                    'not_registered': sorted(set(chosen) - {item[0] for item in linked}),
                },
            )
            for asset_id, ticker, fund, isin, source in with_source:
                if await self.ingestion_service.is_aborted(current_execution_id):
                    return current_execution_id
                if source == EtfHoldingSource.SEC_NPORT:
                    await self._ingest_nport(current_execution_id, asset_id, ticker, fund)
                elif source == EtfHoldingSource.DWS:
                    await self._ingest_dws_file(current_execution_id, asset_id, ticker, fund, isin)
                else:
                    # A source named in the domain with no reader here.
                    raise NotImplementedError(f'No reader for ETF holdings source {source}')
            # Only American holdings are asked of OpenFIGI: the question is
            # which American ticker an ISIN trades under, and a UCITS fund's
            # holdings are mostly not American. Those are still tied, when
            # written, to any asset already carrying their ISIN.
            american = [item[2].id for item in with_source if item[4] == EtfHoldingSource.SEC_NPORT]
            if american and not await self.ingestion_service.is_aborted(current_execution_id):
                await self._link_holdings(current_execution_id, american)
            await self.ingestion_service.finish(current_execution_id)
            return current_execution_id
        except Exception as exc:
            logger.exception('ETF holdings ingestion failed')
            await self.ingestion_service.fail(current_execution_id, exc)
            raise

    async def _ingest_nport(self, execution_id: int, asset_id: int, ticker: str, fund) -> None:
        parameters: dict = {'series_id': fund.sec_series_id, 'fund': fund.name}
        attempt_id = await self.ingestion_service.start_attempt(
            execution_id,
            item_id=asset_id,
            item_label=ticker,
            source=PROVIDER,
            parameters=parameters,
        )
        try:
            filing = await self.sec.latest_nport(fund.sec_series_id)
            if filing is None:
                parameters['status'] = 'no_filing'
                await self.ingestion_service.finish_attempt(
                    execution_id, attempt_id, status='success', parameters=parameters
                )
                return
            parameters.update(accession=filing.accession, report_date=filing.period.isoformat())
            async with self.uow_factory() as uow:
                stored = await uow.etf_registry.get_holding_report(fund.id, filing.period)
            # Skipped by what is stored, not by the search: the same filing,
            # already applied to this fund and date.
            if stored is not None and stored.accession == filing.accession:
                parameters['status'] = 'not_modified'
                await self.ingestion_service.finish_attempt(
                    execution_id, attempt_id, status='success', parameters=parameters
                )
                return

            document = await self.sec.nport_document(filing)
            report = await asyncio.to_thread(read_nport_document, document)
            if report.series_id != fund.sec_series_id:
                raise ValueError(
                    f'N-PORT {filing.accession} is for {report.series_id}, not {fund.sec_series_id}'
                )
            async with self.uow_factory() as uow:
                await uow.etf_registry.replace_holding_report(
                    {
                        'etf_registry_id': fund.id,
                        'report_date': report.report_date,
                        'source': EtfHoldingSource.SEC_NPORT,
                        'accession': filing.accession,
                        'net_assets': report.net_assets,
                        'total_assets': report.total_assets,
                        'fetched_at': datetime.now(UTC),
                    },
                    report.holdings,
                )
                await uow.commit()
            parameters.update(status='downloaded', holdings=len(report.holdings))
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='success',
                parameters=parameters,
                fetched_rows=len(report.holdings),
                upserted_rows=len(report.holdings),
            )
        except Exception as exc:
            logger.exception('ETF holdings for %s failed', ticker)
            parameters['status'] = 'failed'
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='failure',
                parameters=parameters,
                error=str(exc) or exc.__class__.__name__,
            )

    async def _ingest_dws_file(
        self, execution_id: int, asset_id: int, ticker: str, fund, isin: str
    ) -> None:
        """Today's DWS constituents file for the class, skipped when its date
        is already stored from the same source."""
        parameters: dict = {'isin': isin, 'fund': fund.name}
        attempt_id = await self.ingestion_service.start_attempt(
            execution_id,
            item_id=asset_id,
            item_label=ticker,
            source=DWS_PROVIDER,
            parameters=parameters,
        )
        try:
            content = await self.dws.constituents(isin)
            report = await asyncio.to_thread(read_dws_constituents, content)
            parameters['report_date'] = report.report_date.isoformat()
            async with self.uow_factory() as uow:
                stored = await uow.etf_registry.get_holding_report(fund.id, report.report_date)
                if stored is not None and stored.source == EtfHoldingSource.DWS:
                    parameters['status'] = 'not_modified'
                else:
                    await uow.etf_registry.replace_holding_report(
                        {
                            'etf_registry_id': fund.id,
                            'report_date': report.report_date,
                            'source': EtfHoldingSource.DWS,
                            # A manager's file has no accession: its date is
                            # what tells one apart from the next.
                            'accession': report.report_date.isoformat(),
                            'fetched_at': datetime.now(UTC),
                        },
                        report.holdings,
                    )
                    await uow.commit()
                    parameters.update(status='downloaded', holdings=len(report.holdings))
            written = len(report.holdings) if parameters['status'] == 'downloaded' else 0
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='success',
                parameters=parameters,
                fetched_rows=len(report.holdings),
                upserted_rows=written,
            )
        except Exception as exc:
            logger.exception('ETF holdings for %s failed', ticker)
            parameters['status'] = 'failed'
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='failure',
                parameters=parameters,
                error=str(exc) or exc.__class__.__name__,
            )

    async def _link_holdings(self, execution_id: int, fund_ids: list[int]) -> None:
        """Tie each holding to the registered asset it is, through the ISIN.

        The filing gives a holding's ISIN and no ticker; an American stock is
        registered here by ticker and, until now, without an ISIN. So the ISINs
        no asset carries yet are asked of OpenFIGI, and an ISIN whose American
        ticker names exactly one registered American asset becomes that asset's
        ISIN. Nothing is overwritten: an asset that already has an ISIN keeps
        it, and a ticker two assets share is left for a person.
        """
        parameters: dict = {}
        attempt_id = await self.ingestion_service.start_attempt(
            execution_id,
            item_id=None,
            item_label='Vínculo com os ativos',
            source=FIGI_PROVIDER,
            parameters=parameters,
        )
        try:
            async with self.uow_factory() as uow:
                isins = await uow.etf_registry.unlinked_holding_isins(fund_ids)
            tickers = await self.figi.us_tickers(isins) if isins else {}
            resolved: list[str] = []
            ambiguous: list[str] = []
            not_registered: list[str] = []
            async with self.uow_factory() as uow:
                repo = uow.etf_registry
                assets = await repo.get_assets_by_ticker(
                    sorted({ticker for found in tickers.values() for ticker in found})
                )
                for isin, found in sorted(tickers.items()):
                    candidates = [
                        asset
                        for ticker in found
                        for asset in assets.get(ticker, [])
                        if not is_brazilian_market(
                            asset.exchange.code if asset.exchange else None, asset.ticker
                        )
                    ]
                    if not candidates:
                        not_registered.append(sorted(found)[0])
                    elif len(candidates) > 1:
                        ambiguous.append(isin)
                    elif await repo.set_asset_isin(candidates[0].id, isin):
                        resolved.append(candidates[0].ticker or isin)
                linked = await repo.link_holdings_by_isin()
                await uow.commit()
            parameters.update(
                asked=len(isins),
                without_us_ticker=len(isins) - len(tickers),
                resolved={'count': len(resolved), 'tickers': resolved[:REPORT_SAMPLE]},
                ambiguous=ambiguous[:REPORT_SAMPLE],
                not_registered={
                    'count': len(not_registered),
                    'tickers': not_registered[:REPORT_SAMPLE],
                },
                holdings_linked=linked,
            )
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='success',
                parameters=parameters,
                fetched_rows=len(isins),
                upserted_rows=linked,
            )
        except Exception as exc:
            logger.exception('Linking ETF holdings to assets failed')
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='failure',
                parameters=parameters,
                error=str(exc) or exc.__class__.__name__,
            )

    async def aclose(self) -> None:
        await self.sec.close()
        await self.figi.close()
        await self.dws.close()
