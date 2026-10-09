from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.composition.portfolio import get_portfolio_reports_service
from app.modules.portfolio.api.access import OwnedPortfolioId
from app.modules.portfolio.domain.portfolio_reports import StatementScope
from app.modules.portfolio.service.portfolio_reports_service import (
    PortfolioReportsService,
)

router = APIRouter(prefix='/report', tags=['Portfolio Report'])


@router.get('/{portfolio_id}/performance_statement.xlsx')
async def get_portfolio_returns(
    portfolio_id: OwnedPortfolioId,
    service: Annotated[PortfolioReportsService, Depends(get_portfolio_reports_service)],
    asset_ids: Annotated[list[int] | None, Query()] = None,
    scope: StatementScope = StatementScope.PORTFOLIO,
):
    return await service.generate_performance_statement(
        portfolio_id=portfolio_id,
        asset_ids=asset_ids,
        scope=scope,
    )
