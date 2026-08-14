import datetime as dt
from dataclasses import dataclass


@dataclass(frozen=True, kw_only=True)
class DividendQuery:
    """Criteria for selecting a portfolio's dividends.

    Not a persisted entity: it carries what a caller wants to filter by, so the
    service and the repository can agree on a shape without either of them
    depending on how the request arrived.
    """

    start_date: dt.date | None = None
    end_date: dt.date | None = None
    asset_id: int | None = None
    asset_type_ids: list[int] | None = None

    def __post_init__(self) -> None:
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError('start_date must be <= end_date')
