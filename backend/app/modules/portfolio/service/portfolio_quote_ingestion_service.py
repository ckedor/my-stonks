from collections.abc import Sequence

from app.infra.db.unit_of_work import UnitOfWork
from app.modules.portfolio.domain.quote_ingestion import (
    FundShareValueSelection,
    QuoteIngestionAssetSelection,
    select_share_value_funds,
)

RECENT_POSITION_WINDOW_DAYS = 5


class PortfolioQuoteIngestionService:
    """Public Portfolio service for selecting assets that need quote ingestion."""

    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def get_assets_requiring_quote_ingestion(
        self,
        *,
        full_history: bool,
        asset_type_ids: Sequence[int],
    ) -> QuoteIngestionAssetSelection:
        async with self.uow as uow:
            if full_history:
                asset_ids = await uow.portfolios.get_all_asset_ids_with_transactions(
                    asset_type_ids=asset_type_ids,
                )
                return QuoteIngestionAssetSelection(
                    asset_ids=asset_ids,
                    position_reference_date=None,
                    position_window_days=None,
                    description='distinct assets from all portfolio transactions',
                )

            reference_date = await uow.portfolios.get_latest_position_date()
            asset_ids = await uow.portfolios.get_recent_position_asset_ids(
                window_days=RECENT_POSITION_WINDOW_DAYS,
                asset_type_ids=asset_type_ids,
            )
        return QuoteIngestionAssetSelection(
            asset_ids=asset_ids,
            position_reference_date=reference_date,
            position_window_days=RECENT_POSITION_WINDOW_DAYS,
            description=(
                'non-zero positions from the global latest '
                f'{RECENT_POSITION_WINDOW_DAYS}-day window'
            ),
        )

    async def get_funds_requiring_share_values(
        self,
        *,
        full_history: bool,
        asset_type_ids: Sequence[int],
        item_ids: Sequence[int] | None = None,
    ) -> FundShareValueSelection:
        """Funds priced from filings, and the earliest purchase each needs values from.

        A routine run takes the funds held recently plus every fund whose trades
        reach dates its positions do not — a first purchase, which has no
        position until it is priced, and a retrodated one. A full run takes every
        fund with a transaction. Funds named by id are taken as asked, with the
        same purchase dates; one never bought is reported, not dropped.
        """
        async with self.uow as uow:
            histories = await uow.portfolios.get_fund_purchase_histories(
                asset_type_ids=asset_type_ids,
                asset_ids=item_ids,
            )
            recently_held = (
                set()
                if full_history or item_ids
                else set(
                    await uow.portfolios.get_recent_position_asset_ids(
                        window_days=RECENT_POSITION_WINDOW_DAYS,
                        asset_type_ids=asset_type_ids,
                    )
                )
            )
        since = select_share_value_funds(
            histories,
            recently_held=recently_held,
            full_history=full_history or bool(item_ids),
        )
        if item_ids:
            description = 'funds chosen by id'
        elif full_history:
            description = 'all funds priced from filings with a transaction'
        else:
            description = (
                'funds held in the latest position window, and funds with purchases '
                'their positions do not cover yet'
            )
        return FundShareValueSelection(
            since=since,
            without_purchase=sorted(set(item_ids or []) - set(since)),
            description=description,
        )

    async def get_positions_to_recalculate(self, asset_ids: Sequence[int]) -> list[tuple[int, int]]:
        """Every (portfolio, asset) pair whose history a change of these assets touches."""
        async with self.uow as uow:
            return await uow.portfolios.get_portfolio_asset_pairs_with_transactions(asset_ids)
