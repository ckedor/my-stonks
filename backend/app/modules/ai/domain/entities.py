from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(eq=False, kw_only=True)
class AIFeature:
    id: int | None = None
    key: str
    default_ttl_hours: int = 168
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class AIArtifact:
    id: UUID | None = None
    feature_id: int
    summary: str
    payload: dict
    expires_at: datetime
    input_hash: str | None = None
    model: str | None = None
    generated_at: datetime | None = None
    created_at: datetime | None = None
    feature: AIFeature | None = None
