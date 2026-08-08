from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RunQuoteIngestionRequest(BaseModel):
    asset_ids: list[int] | None = None
    force_full_history: bool = False


class QuoteIngestionAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    execution_id: int
    asset_id: int | None
    ticker: str
    asset_type_id: int | None
    source: str
    status: str
    parameters: dict[str, Any]
    attempted_at: datetime
    finished_at: datetime | None
    fetched_rows: int
    upserted_rows: int
    error: str | None


class QuoteIngestionExecutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: str | None
    trigger: str
    status: str
    force_full_history: bool
    parameters: dict[str, Any]
    requested_by_user_id: int | None
    requested_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    total_assets: int
    processed_assets: int
    succeeded_assets: int
    failed_assets: int
    fetched_rows: int
    upserted_rows: int
    error: str | None


class QuoteIngestionExecutionDetailResponse(QuoteIngestionExecutionResponse):
    attempts: list[QuoteIngestionAttemptResponse] = Field(default_factory=list)
