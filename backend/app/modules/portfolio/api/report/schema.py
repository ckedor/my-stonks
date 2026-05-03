from pydantic import BaseModel

from app.modules.portfolio.domain.portfolio_reports import StatementScope


class PerformanceStatementRequest(BaseModel):
    asset_ids: list[int] | None = None
    scope: StatementScope = StatementScope.PORTFOLIO