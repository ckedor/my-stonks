from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import delete, func, insert, select, update

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.db.tables.assets import etf_holding_table, etf_registry_manager_table
from app.modules.market_data.domain.assets import ETF, Asset, Institution
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.etf_registry import (
    EtfHolding,
    EtfHoldingReport,
    EtfRegistry,
    EtfRegistryClass,
    EtfRegistrySource,
    EtfRegistryStatus,
)


class EtfRegistryRepository(SQLAlchemyRepository):
    # --- legal entities ------------------------------------------------------

    async def upsert_institutions_by_lei(self, rows: Sequence[dict]) -> dict[str, int]:
        """Write the entities named by LEI and return their ids by LEI.

        Only the fields the LEI sources know are written. An entity that also
        carries a CNPJ keeps it: nothing here can speak for it.
        """
        if rows:
            await self.upsert_bulk(Institution, list(rows), unique_columns=['lei'])
        result = await self.session.execute(
            select(Institution.lei, Institution.id).where(
                Institution.lei.in_([row['lei'] for row in rows])
            )
        )
        return dict(result.all())

    # --- funds and classes ---------------------------------------------------

    async def upsert_funds(self, rows: Sequence[dict], *, key: str) -> dict[str, int]:
        """Write the funds and return their ids by ``key`` (the source's own key)."""
        if rows:
            await self.upsert_bulk(EtfRegistry, list(rows), unique_columns=[key])
        column = getattr(EtfRegistry, key)
        result = await self.session.execute(
            select(column, EtfRegistry.id).where(column.in_([row[key] for row in rows]))
        )
        return dict(result.all())

    async def release_leis(self, source: EtfRegistrySource) -> None:
        """Clear the LEIs of ``source``'s funds before they are written again.

        A LEI can move between series from one filing to the next, and the
        unique constraint would refuse the new holder while the old one still
        had it. The run writes every LEI back in the same transaction.
        """
        await self.session.execute(
            update(EtfRegistry).where(EtfRegistry.source == source.value).values(lei=None)
        )

    async def get_fund_sources_by_lei(self) -> dict[str, str]:
        result = await self.session.execute(
            select(EtfRegistry.lei, EtfRegistry.source).where(EtfRegistry.lei.is_not(None))
        )
        return dict(result.all())

    async def replace_managers(self, pairs: Sequence[tuple[int, int]], fund_ids: Sequence[int]):
        """The managers of ``fund_ids`` become exactly ``pairs`` (fund id, entity id)."""
        await self.session.execute(
            delete(etf_registry_manager_table).where(
                etf_registry_manager_table.c.etf_registry_id.in_(fund_ids)
            )
        )
        if pairs:
            await self.session.execute(
                insert(etf_registry_manager_table),
                [{'etf_registry_id': fund, 'institution_id': entity} for fund, entity in pairs],
            )

    async def upsert_classes(self, rows: Sequence[dict], *, key: str) -> None:
        if rows:
            await self.upsert_bulk(EtfRegistryClass, list(rows), unique_columns=[key])

    async def retire_unseen(self, source: EtfRegistrySource, refreshed_before: datetime) -> dict:
        """Mark inactive what ``source`` no longer lists.

        Every row a run writes is stamped with the run's start, so whatever of
        this source still carries an older stamp was not in the list this
        time. Nothing is deleted: an asset may still point at it.
        """
        funds = await self.session.execute(
            update(EtfRegistry)
            .where(EtfRegistry.source == source.value)
            .where(EtfRegistry.refreshed_at < refreshed_before)
            .where(EtfRegistry.status != EtfRegistryStatus.INACTIVE.value)
            .values(status=EtfRegistryStatus.INACTIVE.value)
        )
        source_funds = select(EtfRegistry.id).where(EtfRegistry.source == source.value)
        classes = await self.session.execute(
            update(EtfRegistryClass)
            .where(EtfRegistryClass.etf_registry_id.in_(source_funds))
            .where(EtfRegistryClass.refreshed_at < refreshed_before)
            .where(EtfRegistryClass.status != EtfRegistryStatus.INACTIVE.value)
            .values(status=EtfRegistryStatus.INACTIVE.value)
        )
        return {'funds': funds.rowcount or 0, 'classes': classes.rowcount or 0}

    # --- the link from an asset ----------------------------------------------

    async def get_etf_assets(self) -> list[Asset]:
        result = await self.session.execute(
            select(Asset).where(Asset.asset_type_id == int(ASSET_TYPE.ETF)).order_by(Asset.id)
        )
        return list(result.unique().scalars().all())

    async def get_etf_links(self) -> dict[int, ETF]:
        result = await self.session.execute(select(ETF))
        return {etf.asset_id: etf for etf in result.unique().scalars().all()}

    async def get_class_ids_by_isin(self) -> dict[str, int]:
        result = await self.session.execute(
            select(EtfRegistryClass.isin, EtfRegistryClass.id).where(
                EtfRegistryClass.isin.is_not(None)
            )
        )
        return dict(result.all())

    async def get_active_class_ids_by_ticker(self) -> dict[str, list[int]]:
        """Ticker -> the active classes that carry it; more than one is ambiguous."""
        result = await self.session.execute(
            select(EtfRegistryClass.ticker, EtfRegistryClass.id)
            .where(EtfRegistryClass.ticker.is_not(None))
            .where(EtfRegistryClass.status == EtfRegistryStatus.ACTIVE.value)
        )
        by_ticker: dict[str, list[int]] = {}
        for ticker, class_id in result.all():
            by_ticker.setdefault(ticker, []).append(class_id)
        return by_ticker

    async def link_classes(self, links: Sequence[dict]) -> None:
        """Point each asset's ETF row at its class, creating the row if missing."""
        if links:
            await self.upsert_bulk(ETF, list(links), unique_columns=['asset_id'])

    # --- holdings --------------------------------------------------------------

    async def get_linked_funds(
        self, asset_ids: Sequence[int]
    ) -> list[tuple[int, str, EtfRegistry]]:
        """(asset id, ticker, fund) for each asset linked to a registered class."""
        if not asset_ids:
            return []
        result = await self.session.execute(
            select(Asset.id, Asset.ticker, EtfRegistry)
            .join(ETF, ETF.asset_id == Asset.id)
            .join(EtfRegistryClass, EtfRegistryClass.id == ETF.etf_registry_class_id)
            .join(EtfRegistry, EtfRegistry.id == EtfRegistryClass.etf_registry_id)
            .where(Asset.id.in_(asset_ids))
            .order_by(Asset.ticker)
        )
        return [(asset_id, ticker or '', fund) for asset_id, ticker, fund in result.all()]

    async def get_holding_report(self, fund_id: int, report_date) -> EtfHoldingReport | None:
        result = await self.session.execute(
            select(EtfHoldingReport)
            .where(EtfHoldingReport.etf_registry_id == fund_id)
            .where(EtfHoldingReport.report_date == report_date)
        )
        return result.scalar_one_or_none()

    async def replace_holding_report(self, report: dict, holdings: Sequence[dict]) -> int:
        """Write a fund's report for a date, replacing any earlier one for it.

        Each line is tied to the registered asset carrying its ISIN, when one
        does; an ISIN several listings share takes the lowest id, which is the
        one registered first.
        """
        await self.session.execute(
            delete(EtfHoldingReport)
            .where(EtfHoldingReport.etf_registry_id == report['etf_registry_id'])
            .where(EtfHoldingReport.report_date == report['report_date'])
        )
        created = EtfHoldingReport(**report, holdings_count=len(holdings))
        self.session.add(created)
        await self.session.flush()
        if holdings:
            await self.session.execute(
                insert(etf_holding_table), [{**row, 'report_id': created.id} for row in holdings]
            )
            listed = (
                select(func.min(Asset.id))
                .where(Asset.isin == etf_holding_table.c.isin)
                .scalar_subquery()
            )
            await self.session.execute(
                update(etf_holding_table)
                .where(etf_holding_table.c.report_id == created.id)
                .where(etf_holding_table.c.isin.is_not(None))
                .values(asset_id=listed)
            )
        return created.id

    # --- reads -----------------------------------------------------------------

    async def get_etf(self, asset_id: int) -> ETF | None:
        result = await self.session.execute(select(ETF).where(ETF.asset_id == asset_id))
        return result.unique().scalar_one_or_none()

    async def get_institutions(self, ids: Sequence[int]) -> dict[int, Institution]:
        if not ids:
            return {}
        result = await self.session.execute(select(Institution).where(Institution.id.in_(ids)))
        return {item.id: item for item in result.scalars().all()}

    async def get_manager_ids(self, fund_id: int) -> list[int]:
        result = await self.session.execute(
            select(etf_registry_manager_table.c.institution_id).where(
                etf_registry_manager_table.c.etf_registry_id == fund_id
            )
        )
        return list(result.scalars().all())

    async def latest_holding_report(self, fund_id: int) -> EtfHoldingReport | None:
        result = await self.session.execute(
            select(EtfHoldingReport)
            .where(EtfHoldingReport.etf_registry_id == fund_id)
            .order_by(EtfHoldingReport.report_date.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def holdings_page(self, report_id: int, *, offset: int, limit: int) -> list[EtfHolding]:
        """Largest first: the order a holding list is read in."""
        result = await self.session.execute(
            select(EtfHolding)
            .where(EtfHolding.report_id == report_id)
            .order_by(EtfHolding.weight.desc().nulls_last(), EtfHolding.id)
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    # --- the link from a holding to a registered asset -----------------------

    async def unlinked_holding_isins(self, fund_ids: Sequence[int]) -> list[str]:
        """ISINs held by these funds that no registered asset carries yet."""
        if not fund_ids:
            return []
        reports = select(EtfHoldingReport.id).where(EtfHoldingReport.etf_registry_id.in_(fund_ids))
        result = await self.session.execute(
            select(etf_holding_table.c.isin)
            .where(etf_holding_table.c.report_id.in_(reports))
            .where(etf_holding_table.c.asset_id.is_(None))
            .where(etf_holding_table.c.isin.is_not(None))
            .distinct()
        )
        return list(result.scalars().all())

    async def get_assets_by_ticker(self, tickers: Sequence[str]) -> dict[str, list[Asset]]:
        if not tickers:
            return {}
        result = await self.session.execute(
            select(Asset).where(func.upper(Asset.ticker).in_([t.upper() for t in tickers]))
        )
        found: dict[str, list[Asset]] = {}
        for asset in result.unique().scalars().all():
            found.setdefault((asset.ticker or '').upper(), []).append(asset)
        return found

    async def set_asset_isin(self, asset_id: int, isin: str) -> bool:
        """Give an asset its ISIN, never replacing one it already has."""
        result = await self.session.execute(
            update(Asset).where(Asset.id == asset_id).where(Asset.isin.is_(None)).values(isin=isin)
        )
        return bool(result.rowcount)

    async def link_holdings_by_isin(self) -> int:
        """Point every unlinked holding at the registered asset with its ISIN."""
        listed = (
            select(func.min(Asset.id))
            .where(Asset.isin == etf_holding_table.c.isin)
            .scalar_subquery()
        )
        result = await self.session.execute(
            update(etf_holding_table)
            .where(etf_holding_table.c.asset_id.is_(None))
            .where(etf_holding_table.c.isin.is_not(None))
            .where(listed.is_not(None))
            .values(asset_id=listed)
        )
        return result.rowcount or 0
