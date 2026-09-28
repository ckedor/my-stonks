"""The weekly registry of foreign ETFs, and the link from an asset to it.

Three items, one attempt each, in this order:

1. **SEC.** Every ETF the last four quarters of N-CEN filings describe, with
   its trust and advisers, and its classes with the tickers the SEC lists now.
2. **FIRDS.** Every UCITS class still traded in the EU, keyed by ISIN, with
   its manager and umbrella from GLEIF.
3. **Assets.** Each ETF asset pointed at its registered class: by ISIN when
   the asset carries one, by ticker for an American listing — the SEC's own
   ticker file, so nothing is guessed.

The first two write reference data and create no asset, like the CVM registry.
The third changes only the link, never a name or a ticker.
"""

import asyncio
from collections import Counter, defaultdict
from collections.abc import Awaitable, Callable
from contextlib import AsyncExitStack
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from app.config.logger import logger
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.integrations.esma_client import PROVIDER as ESMA_PROVIDER
from app.infra.integrations.esma_client import EsmaClient
from app.infra.integrations.gleif_client import GleifClient
from app.infra.integrations.sec_client import PROVIDER as SEC_PROVIDER
from app.infra.integrations.sec_client import SecClient
from app.modules.market_data.adapters.etf_filings import (
    FirdsClass,
    LegalEntity,
    NcenEtf,
    current_tickers,
    firds_class,
    lei_entity,
    read_fund_relationships,
    read_ncen_document,
    read_ncen_etfs,
)
from app.modules.market_data.domain.etf_registry import (
    EtfRegistrySource,
    EtfRegistryStatus,
)
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.market_data.domain.market_scope import is_brazilian_market
from app.modules.market_data.service.data_ingestion_service import DataIngestionService

SEC_ITEM = 1
FIRDS_ITEM = 2
LINK_ITEM = 3
ITEMS = [SEC_ITEM, FIRDS_ITEM, LINK_ITEM]

#: A fund files N-CEN once a year, so four quarters hold every live ETF once.
NCEN_QUARTERS = 4
#: How far back to look for them: the newest quarter is published some weeks
#: after it closes, so it is regularly missing.
NCEN_QUARTERS_SEARCHED = 6

#: How far back EDGAR is searched for a series' N-CEN: a fund files one a
#: year, due 75 days after its fiscal year ends, so the latest is never older.
EDGAR_LOOKBACK = timedelta(days=450)

#: A fund registered with the SEC reports in dollars; its shares are too.
SEC_CLASS_CURRENCY = 'USD'
SEC_DOMICILE = 'US'

#: How many tickers or ISINs a report lists by name, past the counts.
REPORT_SAMPLE = 200


class EtfRegistryIngestionAborted(Exception):
    pass


def recent_quarters(today: date, count: int) -> list[tuple[int, int]]:
    """``(year, quarter)`` from the current one backwards."""
    year, quarter = today.year, (today.month - 1) // 3 + 1
    quarters = []
    for _ in range(count):
        quarters.append((year, quarter))
        quarter -= 1
        if quarter == 0:
            year, quarter = year - 1, 4
    return quarters


def _entity_row(entity: LegalEntity, refreshed_at: datetime) -> dict:
    return {
        'lei': entity.lei,
        'name': entity.name,
        'legal_name': entity.name,
        'country': entity.country,
        'refreshed_at': refreshed_at,
    }


class EtfRegistryIngestionService:
    def __init__(
        self,
        *,
        uow_factory: Callable[[], UnitOfWork],
        ingestion_service: DataIngestionService,
        sec: SecClient,
        esma: EsmaClient,
        gleif: GleifClient,
    ):
        self.uow_factory = uow_factory
        self.ingestion_service = ingestion_service
        self.sec = sec
        self.esma = esma
        self.gleif = gleif

    async def run(self, *, execution_id: int | None = None) -> int | None:
        prepared = await self.ingestion_service.prepare_execution(
            ingestion_type=DataIngestionType.ETF_REGISTRY,
            execution_id=execution_id,
            force_full_history=False,
            scheduled_item_ids=ITEMS,
        )
        if prepared is None:
            return execution_id
        current_execution_id, _, _ = prepared
        try:
            await self.ingestion_service.set_execution_items(
                current_execution_id, item_ids=ITEMS, parameters={'item_ids': ITEMS}
            )
            for item_id, label, source, work in (
                (SEC_ITEM, 'SEC N-CEN', SEC_PROVIDER, self._ingest_sec),
                (FIRDS_ITEM, 'ESMA FIRDS', ESMA_PROVIDER, self._ingest_firds),
                (LINK_ITEM, 'Ativos', 'registry', self._link_assets),
            ):
                if await self.ingestion_service.is_aborted(current_execution_id):
                    return current_execution_id
                await self._attempt(current_execution_id, item_id, label, source, work)
            await self.ingestion_service.finish(current_execution_id)
            return current_execution_id
        except Exception as exc:
            logger.exception('ETF registry ingestion failed')
            await self.ingestion_service.fail(current_execution_id, exc)
            raise

    async def _attempt(
        self,
        execution_id: int,
        item_id: int,
        label: str,
        source: str,
        work: Callable[[int], Awaitable[dict]],
    ) -> None:
        attempt_id = await self.ingestion_service.start_attempt(
            execution_id, item_id=item_id, item_label=label, source=source, parameters={}
        )
        try:
            report = await work(execution_id)
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='success',
                parameters=report,
                fetched_rows=report.get('fetched', 0),
                upserted_rows=report.get('upserted', 0),
            )
        except EtfRegistryIngestionAborted:
            return
        except Exception as exc:
            logger.exception('ETF registry item %s failed', label)
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='failure',
                parameters={'status': 'failed'},
                error=str(exc) or exc.__class__.__name__,
            )

    async def _check_abort(self, execution_id: int) -> None:
        if await self.ingestion_service.is_aborted(execution_id):
            raise EtfRegistryIngestionAborted

    # --- SEC -----------------------------------------------------------------

    async def _ingest_sec(self, execution_id: int) -> dict:
        now = datetime.now(UTC)
        ticker_rows = await self.sec.fund_tickers()
        tickers = current_tickers(ticker_rows)

        read_quarters: list[str] = []
        async with AsyncExitStack() as stack:
            paths: list[Path] = []
            for year, quarter in recent_quarters(now.date(), NCEN_QUARTERS_SEARCHED):
                path = await stack.enter_async_context(self.sec.ncen_quarter(year, quarter))
                if path is None:
                    continue
                paths.append(path)
                read_quarters.append(f'{year}q{quarter}')
                if len(paths) == NCEN_QUARTERS:
                    break
            await self._check_abort(execution_id)
            etfs = await asyncio.to_thread(read_ncen_etfs, paths)
        from_edgar = await self._complete_from_edgar(execution_id, etfs, ticker_rows)

        entities: dict[str, LegalEntity] = {}
        for etf in etfs.values():
            for entity in (etf.trust, *etf.advisers):
                if entity is not None:
                    entities[entity.lei] = entity

        # A LEI filed for more than one series identifies none of them. So does
        # one a UCITS fund already holds: it is that fund's.
        filings_per_lei = Counter(etf.lei for etf in etfs.values() if etf.lei)

        await self._check_abort(execution_id)
        async with self.uow_factory() as uow:
            repo = uow.etf_registry
            held_in_europe = {
                lei
                for lei, source in (await repo.get_fund_sources_by_lei()).items()
                if source == EtfRegistrySource.ESMA
            }
            fund_leis = {
                etf.series_id: etf.lei
                for etf in etfs.values()
                if etf.lei and filings_per_lei[etf.lei] == 1 and etf.lei not in held_in_europe
            }
            entity_ids = await repo.upsert_institutions_by_lei([
                _entity_row(entity, now) for entity in entities.values()
            ])
            await repo.release_leis(EtfRegistrySource.SEC)
            fund_ids = await repo.upsert_funds(
                [
                    {
                        'lei': fund_leis.get(etf.series_id),
                        'source': EtfRegistrySource.SEC.value,
                        'sec_series_id': etf.series_id,
                        'name': etf.name,
                        'domicile': SEC_DOMICILE,
                        'umbrella_institution_id': entity_ids.get(etf.trust.lei)
                        if etf.trust
                        else None,
                        'tracks_index': etf.tracks_index,
                        'leveraged_or_inverse': etf.leveraged_or_inverse,
                        'fund_of_funds': etf.fund_of_funds,
                        'status': (
                            EtfRegistryStatus.ACTIVE
                            if etf.series_id in tickers
                            else EtfRegistryStatus.INACTIVE
                        ).value,
                        'refreshed_at': now,
                    }
                    for etf in etfs.values()
                ],
                key='sec_series_id',
            )
            await repo.replace_managers(
                [
                    (fund_ids[etf.series_id], entity_ids[adviser.lei])
                    for etf in etfs.values()
                    for adviser in etf.advisers
                    if etf.series_id in fund_ids and adviser.lei in entity_ids
                ],
                list(fund_ids.values()),
            )
            classes = self._sec_classes(etfs, tickers, fund_ids, now)
            await repo.upsert_classes(classes, key='sec_class_id')
            retired = await repo.retire_unseen(EtfRegistrySource.SEC, now)
            await uow.commit()

        return {
            'quarters': read_quarters,
            'fetched': len(etfs),
            'upserted': len(fund_ids),
            'funds': len(fund_ids),
            'classes': len(classes),
            'listed_classes': sum(1 for row in classes if row['status'] == 'active'),
            'legal_entities': len(entity_ids),
            'series_without_own_lei': len(etfs) - len(fund_leis),
            'read_from_edgar': from_edgar,
            'retired': retired,
        }

    async def _complete_from_edgar(
        self, execution_id: int, etfs: dict[str, NcenEtf], ticker_rows: list[list]
    ) -> dict:
        """Read from EDGAR the app's ETFs the data sets left out.

        The quarterly data sets miss filings EDGAR holds — Amplify's of
        December 2025 is in none of them — which is about one ETF in fourteen.
        For the universe that gap stays: closing it means asking EDGAR about
        every series it lists, most of them mutual funds. For an ETF the app
        registers it is closed here, so its link does not depend on which
        filings made it into a data set. A series with no N-CEN at all is a
        fund in its first year, which has not filed one yet.
        """
        series_by_ticker = {
            str(symbol).strip().upper(): (int(cik), str(series_id))
            for cik, series_id, _class_id, symbol in ticker_rows
            if cik and series_id and symbol
        }
        async with self.uow_factory() as uow:
            assets = await uow.etf_registry.get_etf_assets()
        missing: dict[int, set[str]] = defaultdict(set)
        for asset in assets:
            exchange = asset.exchange.code if asset.exchange else None
            if asset.isin or is_brazilian_market(exchange, asset.ticker):
                continue
            listed = series_by_ticker.get((asset.ticker or '').strip().upper())
            if listed and listed[1] not in etfs:
                missing[listed[0]].add(listed[1])

        oldest = datetime.now(UTC).date() - EDGAR_LOOKBACK
        added = documents = 0
        for cik, wanted in sorted(missing.items()):
            remaining = set(wanted)
            for filing in await self.sec.ncen_filings(cik):
                if not remaining or filing.filed < oldest:
                    break
                await self._check_abort(execution_id)
                reported = await self.sec.ncen_series(filing)
                if not remaining & reported:
                    continue
                documents += 1
                document = await self.sec.ncen_document(filing)
                found = await asyncio.to_thread(read_ncen_document, document, filed=filing.filed)
                for series_id, etf in found.items():
                    known = etfs.get(series_id)
                    if known is None or known.filed < etf.filed:
                        added += known is None
                        etfs[series_id] = etf
                remaining -= found.keys()
                # A series the filing names but does not describe as an ETF is
                # not one, and an older filing will not say otherwise.
                remaining -= reported
        looked_up = {series for wanted in missing.values() for series in wanted}
        return {
            'series_looked_up': len(looked_up),
            'trusts': len(missing),
            'filings_read': documents,
            'series_added': added,
            'without_ncen': sorted(series for series in looked_up if series not in etfs),
        }

    @staticmethod
    def _sec_classes(etfs, tickers, fund_ids, now: datetime) -> list[dict]:
        """Every class N-CEN reported or the ticker file lists, for each ETF.

        The ticker file is the current word on tickers, and a class it lists
        is the one that trades now. N-CEN is up to a year old, so a class only
        it names is kept, as not listed, with the ticker it had then.
        """
        rows: dict[str, dict] = {}
        for etf in etfs.values():
            fund_id = fund_ids.get(etf.series_id)
            if fund_id is None:
                continue
            listed = tickers.get(etf.series_id, {})
            reported = {share_class.class_id: share_class for share_class in etf.classes}
            for class_id in {*reported, *listed}:
                share_class = reported.get(class_id)
                rows[class_id] = {
                    'sec_class_id': class_id,
                    'etf_registry_id': fund_id,
                    'isin': None,
                    'ticker': listed.get(class_id) or (share_class.ticker if share_class else None),
                    'name': (share_class.name if share_class else '') or etf.name,
                    'currency': SEC_CLASS_CURRENCY,
                    'distribution_policy': None,
                    'cfi_code': None,
                    'status': (
                        EtfRegistryStatus.ACTIVE
                        if class_id in listed
                        else EtfRegistryStatus.INACTIVE
                    ).value,
                    'refreshed_at': now,
                }
        return list(rows.values())

    # --- FIRDS and GLEIF -----------------------------------------------------

    async def _ingest_firds(self, execution_id: int) -> dict:
        now = datetime.now(UTC)
        classes: dict[str, FirdsClass] = {}
        invalid = 0
        async for page in self.esma.etf_classes():
            await self._check_abort(execution_id)
            for document in page:
                share_class = firds_class(document)
                if share_class is None:
                    invalid += 1
                    continue
                classes[share_class.isin] = share_class
        fetched = len(classes) + invalid

        async with self.uow_factory() as uow:
            sources = await uow.etf_registry.get_fund_sources_by_lei()
        # A fund the SEC registers is the SEC's, even when one of its classes
        # also trades in Europe under a non-American ISIN.
        sec_owned = sorted(
            isin for isin, c in classes.items() if sources.get(c.lei) == EtfRegistrySource.SEC
        )
        for isin in sec_owned:
            del classes[isin]

        fund_leis = {share_class.lei for share_class in classes.values()}
        async with self.gleif.relationships() as path:
            await self._check_abort(execution_id)
            relationships = await asyncio.to_thread(read_fund_relationships, path, fund_leis)

        # The issuer FIRDS names is the umbrella, not a sub-fund: which of its
        # sub-funds the class belongs to is not in the data, and a guess would
        # file it under the wrong fund.
        umbrella_issued = sorted(
            isin for isin, c in classes.items() if c.lei in relationships.umbrella_leis
        )
        for isin in umbrella_issued:
            del classes[isin]
        fund_leis = {share_class.lei for share_class in classes.values()}

        described = fund_leis | set(relationships.umbrellas.values())
        for fund in fund_leis:
            described.update(relationships.managers.get(fund, []))
        await self._check_abort(execution_id)
        entities = {
            entity.lei: entity
            for entity in map(lei_entity, await self.gleif.lei_records(sorted(described)))
            if entity is not None
        }

        first_class_by_fund: dict[str, FirdsClass] = {}
        for share_class in sorted(classes.values(), key=lambda c: c.isin):
            first_class_by_fund.setdefault(share_class.lei, share_class)
        related = {
            lei
            for fund in fund_leis
            for lei in (relationships.umbrellas.get(fund), *relationships.managers.get(fund, []))
            if lei and lei in entities
        }

        await self._check_abort(execution_id)
        async with self.uow_factory() as uow:
            repo = uow.etf_registry
            entity_ids = await repo.upsert_institutions_by_lei([
                _entity_row(entities[lei], now) for lei in sorted(related)
            ])
            fund_ids = await repo.upsert_funds(
                [
                    {
                        'lei': lei,
                        'source': EtfRegistrySource.ESMA.value,
                        'sec_series_id': None,
                        'name': entities[lei].name if lei in entities else first.name,
                        'domicile': entities[lei].country if lei in entities else first.isin[:2],
                        'umbrella_institution_id': entity_ids.get(
                            relationships.umbrellas.get(lei, '')
                        ),
                        'tracks_index': None,
                        'leveraged_or_inverse': None,
                        'fund_of_funds': None,
                        'status': EtfRegistryStatus.ACTIVE.value,
                        'refreshed_at': now,
                    }
                    for lei, first in first_class_by_fund.items()
                ],
                key='lei',
            )
            await repo.replace_managers(
                [
                    (fund_ids[fund], entity_ids[manager])
                    for fund in fund_ids
                    for manager in relationships.managers.get(fund, [])
                    if manager in entity_ids
                ],
                list(fund_ids.values()),
            )
            await repo.upsert_classes(
                [
                    {
                        'isin': share_class.isin,
                        'etf_registry_id': fund_ids[share_class.lei],
                        'sec_class_id': None,
                        'ticker': None,
                        'name': share_class.name,
                        'currency': share_class.currency,
                        'distribution_policy': (
                            share_class.distribution_policy.value
                            if share_class.distribution_policy
                            else None
                        ),
                        'cfi_code': share_class.cfi_code,
                        'status': EtfRegistryStatus.ACTIVE.value,
                        'refreshed_at': now,
                    }
                    for share_class in classes.values()
                ],
                key='isin',
            )
            retired = await repo.retire_unseen(EtfRegistrySource.ESMA, now)
            await uow.commit()

        return {
            'fetched': fetched,
            'upserted': len(classes),
            'funds': len(fund_ids),
            'classes': len(classes),
            'legal_entities': len(entity_ids),
            'funds_unknown_to_gleif': len(fund_leis - entities.keys()),
            'invalid_identifiers': invalid,
            'issued_by_umbrella': {
                'count': len(umbrella_issued),
                'isins': umbrella_issued[:REPORT_SAMPLE],
            },
            'registered_by_sec': len(sec_owned),
            'retired': retired,
        }

    # --- assets --------------------------------------------------------------

    async def _link_assets(self, execution_id: int) -> dict:
        report: dict = {
            'linked': [],
            'unchanged': 0,
            'unmatched': [],
            'ambiguous': [],
            'brazilian': 0,
            'registered_with_cvm': 0,
        }
        async with self.uow_factory() as uow:
            repo = uow.etf_registry
            assets = await repo.get_etf_assets()
            links = await repo.get_etf_links()
            by_isin = await repo.get_class_ids_by_isin()
            by_ticker = await repo.get_active_class_ids_by_ticker()

            pending: list[dict] = []
            for asset in assets:
                etf = links.get(asset.id)
                if etf is not None and etf.fund_registry_id is not None:
                    report['registered_with_cvm'] += 1
                    continue
                ticker = (asset.ticker or '').strip().upper()
                if asset.isin:
                    class_id = by_isin.get(asset.isin)
                else:
                    exchange = asset.exchange.code if asset.exchange else None
                    # A B3 ETF is a Brazilian fund: it belongs to the CVM
                    # registry, and a ticker here says nothing about it.
                    if is_brazilian_market(exchange, asset.ticker):
                        report['brazilian'] += 1
                        continue
                    candidates = by_ticker.get(ticker, [])
                    if len(candidates) > 1:
                        report['ambiguous'].append(ticker)
                        continue
                    class_id = candidates[0] if candidates else None
                if class_id is None:
                    report['unmatched'].append(asset.isin or ticker)
                    continue
                current = etf.etf_registry_class_id if etf is not None else None
                if current == class_id:
                    report['unchanged'] += 1
                    continue
                pending.append({'asset_id': asset.id, 'etf_registry_class_id': class_id})
                report['linked'].append(ticker)

            await self._check_abort(execution_id)
            await repo.link_classes(pending)
            await uow.commit()

        return {
            'fetched': len(assets),
            'upserted': len(pending),
            'linked': {'count': len(report['linked']), 'tickers': report['linked'][:REPORT_SAMPLE]},
            'unchanged': report['unchanged'],
            'unmatched': {
                'count': len(report['unmatched']),
                'tickers': sorted(report['unmatched'])[:REPORT_SAMPLE],
            },
            'ambiguous': sorted(report['ambiguous']),
            'brazilian': report['brazilian'],
            'registered_with_cvm': report['registered_with_cvm'],
        }

    async def aclose(self) -> None:
        await self.sec.close()
        await self.esma.close()
        await self.gleif.close()
