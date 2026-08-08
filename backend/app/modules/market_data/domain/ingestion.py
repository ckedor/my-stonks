from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class DataIngestionType(StrEnum):
    QUOTE = 'quote'
    MARKET_DATA_SERIES = 'market_data_series'
    USD_BRL = 'usd_brl'


@dataclass(eq=False, kw_only=True)
class DataIngestionExecution:
    ingestion_type: DataIngestionType | str
    trigger: str
    status: str
    force_full_history: bool = False
    parameters: dict[str, Any] = field(default_factory=dict)
    requested_by_user_id: int | None = None
    id: int | None = None
    task_id: str | None = None
    requested_at: datetime | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    total_items: int = 0
    processed_items: int = 0
    succeeded_items: int = 0
    failed_items: int = 0
    fetched_rows: int = 0
    upserted_rows: int = 0
    error: str | None = None
    attempts: list['DataIngestionAttempt'] = field(default_factory=list)

    @property
    def total_assets(self) -> int:
        return self.total_items

    @property
    def processed_assets(self) -> int:
        return self.processed_items

    @property
    def succeeded_assets(self) -> int:
        return self.succeeded_items

    @property
    def failed_assets(self) -> int:
        return self.failed_items


@dataclass(eq=False, kw_only=True)
class DataIngestionAttempt:
    execution_id: int
    item_label: str
    source: str
    status: str
    parameters: dict[str, Any] = field(default_factory=dict)
    item_id: int | None = None
    id: int | None = None
    attempted_at: datetime | None = None
    finished_at: datetime | None = None
    fetched_rows: int = 0
    upserted_rows: int = 0
    error: str | None = None

    @property
    def asset_id(self) -> int | None:
        return self.item_id

    @property
    def ticker(self) -> str:
        return self.item_label

    @property
    def asset_type_id(self) -> int | None:
        value = self.parameters.get('asset_type_id')
        return int(value) if value is not None else None
