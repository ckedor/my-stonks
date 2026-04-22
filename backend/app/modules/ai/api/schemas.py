from datetime import datetime

from pydantic import BaseModel, Field


class AIFeatureUpdate(BaseModel):
    default_ttl_hours: int | None = Field(default=None, ge=1)


class AIFeatureResponse(BaseModel):
    id: int
    key: str
    default_ttl_hours: int
    created_at: datetime
    updated_at: datetime

    model_config = {'from_attributes': True}


class AssetOverviewAndNewsResponse(BaseModel):
    feature_key: str
    ticker: str
    summary: str
    payload: dict
    model: str | None
    generated_at: datetime
    expires_at: datetime
