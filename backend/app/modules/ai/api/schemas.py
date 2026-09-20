from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AIFeatureResponse(BaseModel):
    model_config = {'from_attributes': True}

    id: int
    key: str
    name: str
    description: str
    output_schema_version: int
    enabled: bool
    freshness: str
    ttl_hours: int | None
    created_at: datetime
    updated_at: datetime


class AIFeatureUpdateRequest(BaseModel):
    name: str
    description: str = ''
    enabled: bool = True
    freshness: str
    #: Null is what a manually-refreshed feature stores, and the service
    #: refuses the two incoherent combinations rather than guessing one.
    ttl_hours: int | None = Field(default=None, ge=1)


class AIPromptVersionResponse(BaseModel):
    model_config = {'from_attributes': True}

    id: int
    feature_id: int
    version: int
    system: str
    template: str
    model: str
    temperature: float
    max_output_tokens: int | None
    web_search: bool
    is_active: bool
    notes: str
    created_at: datetime


class AIPromptVersionCreateRequest(BaseModel):
    system: str = ''
    template: str
    model: str
    temperature: float = 0.2
    max_output_tokens: int | None = Field(default=None, ge=1)
    web_search: bool = False
    notes: str = ''
    #: Saving without activating keeps the current answer in place, which is
    #: how a version can be written now and switched on later.
    activate: bool = True


class AIArtifactResponse(BaseModel):
    """One answer, plus what it cost to have it.

    The generation date is part of the contract and not decoration: on a
    manually-refreshed feature it is the only thing telling a reader whether to
    ask for a new one.
    """

    model_config = {'from_attributes': True}

    feature_key: str
    payload: dict[str, Any]
    schema_version: int
    model: str
    generated_at: datetime
    expires_at: datetime | None
    prompt_version: int
    from_cache: bool
    provider: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    latency_ms: int


class AIRunResponse(BaseModel):
    model_config = {'from_attributes': True}

    feature_id: int | None
    prompt_version_id: int | None
    label: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    latency_ms: int
    status: str
    error: str | None
    trace_id: str | None
    created_at: datetime


class AIUsageRowResponse(BaseModel):
    day: datetime
    label: str
    model: str
    runs: int
    input_tokens: int
    output_tokens: int
    cost_usd: float


class AIFeatureFormResponse(BaseModel):
    """What the admin needs to run a feature it was never told about.

    The input schema builds the form and the context keys document what the
    prompt may refer to. Both are declared on the handler, so a feature added
    later gets its screen without a line of frontend.
    """

    feature_key: str
    input_schema: dict[str, Any]
    context_keys: list[str]


class AITaskDispatchResponse(BaseModel):
    task_id: str
    task_name: str
