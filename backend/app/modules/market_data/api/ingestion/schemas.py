from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RunDataIngestionRequest(BaseModel):
    item_ids: list[int] | None = None
    force_full_history: bool = False


class RunMarketDataSeriesIngestionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    force_full_history: bool = False


class RunUsdBrlIngestionRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    force_full_history: bool = False


class DataIngestionAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    execution_id: int
    item_id: int | None
    item_label: str
    source: str
    status: str
    parameters: dict[str, Any]
    attempted_at: datetime
    finished_at: datetime | None
    fetched_rows: int
    upserted_rows: int
    error: str | None


class DataIngestionExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ingestion_type: str
    task_id: str | None
    trigger: str
    status: str
    force_full_history: bool
    parameters: dict[str, Any]
    requested_by_user_id: int | None
    requested_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    total_items: int
    processed_items: int
    succeeded_items: int
    failed_items: int
    fetched_rows: int
    upserted_rows: int
    error: str | None


class DataIngestionExecutionDetailResponse(DataIngestionExecutionResponse):
    attempts: list[DataIngestionAttemptResponse] = Field(default_factory=list)
