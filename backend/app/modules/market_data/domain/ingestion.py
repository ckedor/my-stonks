from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class DataIngestionType(StrEnum):
    QUOTE = 'quote'
    MARKET_DATA_SERIES = 'market_data_series'
    USD_BRL = 'usd_brl'


#: An execution in one of these has not reached an outcome yet, so it still
#: holds the one-execution-per-type slot. Every other status is terminal.
ACTIVE_EXECUTION_STATUSES = ('queued', 'running')

#: Terminal status of an execution stopped on purpose. It is the final word on
#: an execution: work already in flight must not overwrite it with its own
#: outcome, which is what tells a caller the run was cut short rather than
#: having genuinely succeeded or failed.
ABORTED_STATUS = 'aborted'


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
