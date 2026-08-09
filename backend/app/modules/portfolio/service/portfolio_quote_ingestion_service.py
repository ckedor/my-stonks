from collections.abc import Sequence

from app.modules.portfolio.domain.quote_ingestion import QuoteIngestionAssetSelection
from app.infra.db.unit_of_work import UnitOfWork

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
