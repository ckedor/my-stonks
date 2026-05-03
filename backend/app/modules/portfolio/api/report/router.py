from app.infra.db.session import get_session
from app.modules.portfolio.domain.portfolio_reports import StatementScope
from app.modules.portfolio.service.portfolio_reports_service import (
    PortfolioReportsService,
)
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/report', tags=['Portfolio Report'])


@router.get('/{portfolio_id}/performance_statement.xlsx')
async def get_portfolio_returns(
    portfolio_id: int,
    asset_ids: list[int] | None = Query(default=None),
    scope: StatementScope = StatementScope.PORTFOLIO,
    session=Depends(get_session),
):
    service = PortfolioReportsService(session)
    return await service.generate_performance_statement(
        portfolio_id=portfolio_id,
        asset_ids=asset_ids,
        scope=scope,
    )