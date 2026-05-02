from app.lib.utils.df import rows_to_df
from app.lib.utils.fastapi import df_to_xlsx_response
from app.modules.portfolio.domain.portfolio_reports import StatementScope
from app.modules.portfolio.repositories.portfolio_repository import PortfolioRepository


class PortfolioReportsService:
    def __init__(self, session):
        self.session = session
        self.repo: PortfolioRepository = PortfolioRepository(session)

    async def generate_performance_statement(
        self,
        portfolio_id: int,
        scope: StatementScope = StatementScope.PORTFOLIO,
        asset_ids: list[int] | None = None,
        asset_tickers: list[str] | None = None,
        category_ids: list[int] | None = None,
    ):
        if scope == StatementScope.PORTFOLIO:
            asset_ids = None
            category_ids = None

        elif scope == StatementScope.ASSET and not (asset_ids or asset_tickers):
            raise ValueError(
                f'asset_ids or asset_tickers is required when scope={StatementScope.ASSET}'
            )

        elif scope == StatementScope.CATEGORY and not category_ids:
            raise ValueError(
                f'category_ids is required when scope={StatementScope.CATEGORY}'
            )
            
        position_history_df = rows_to_df(
            await self.repo.get_complete_portfolio_position_history(
                portfolio_id=portfolio_id,
                asset_ids=asset_ids,
            ),
            datetime_cols=['date'],
        )
        return df_to_xlsx_response(
            position_history_df, 
            filename=f'performance_statement.xlsx',
            sheet_name='Performance Statement'
        )
