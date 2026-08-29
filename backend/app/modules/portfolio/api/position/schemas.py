from datetime import datetime

from pydantic import BaseModel


class PortfolioConsolidation(BaseModel):
    """When the portfolio's derived data was last rebuilt.

    `consolidated_at` is when the run finished, not the date the numbers reach:
    that one is bounded by the last quote ingested.
    """

    consolidated_at: datetime
    status: str
    error: str | None = None
