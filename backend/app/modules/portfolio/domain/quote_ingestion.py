from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class QuoteIngestionAssetSelection:
    asset_ids: list[int]
    position_reference_date: date | None
    position_window_days: int | None
    description: str
