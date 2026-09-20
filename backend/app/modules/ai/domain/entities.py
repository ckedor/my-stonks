from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from app.modules.ai.domain.enums import AIFreshness, AIRunStatus


@dataclass(eq=False, kw_only=True)
class AIFeature:
    """A registered AI capability, and how long its answers stay current."""

    id: int | None = None
    key: str
    name: str
    description: str = ''
    output_schema_version: int = 1
    enabled: bool = True
    freshness: str = AIFreshness.TIME
    #: Hours an artifact stays current. Meaningless — and null — when the
    #: freshness is manual, where only a refresh replaces an answer.
    ttl_hours: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    def expiry_for(self, generated_at: datetime) -> datetime | None:
        if self.freshness == AIFreshness.MANUAL or not self.ttl_hours:
            return None
        return generated_at + timedelta(hours=self.ttl_hours)


@dataclass(eq=False, kw_only=True)
class AIPromptVersion:
    """One immutable revision of a feature's prompt.

    Editing a prompt never rewrites a row: it writes the next version and
    activates it. That is what lets an artifact point at the exact text that
    produced it, and what makes the previous answers comparable instead of
    lost.
    """

    id: int | None = None
    feature_id: int
    version: int
    system: str = ''
    template: str
    model: str
    temperature: float = 0.2
    max_output_tokens: int | None = None
    web_search: bool = False
    is_active: bool = False
    notes: str = ''
    created_at: datetime | None = None


@dataclass(eq=False, kw_only=True)
class AIArtifact:
    """A generated answer, kept for one feature, one prompt version and one input.

    The prompt version is part of its identity, not metadata about it. Activating
    a new version therefore retires the answers the old one gave, without a job
    to invalidate anything — the next read simply looks for a row that is not
    there yet.
    """

    id: UUID | None = None
    feature_id: int
    prompt_version_id: int
    input_hash: str
    input: dict[str, Any] = field(default_factory=dict)
    payload: dict[str, Any] = field(default_factory=dict)
    schema_version: int = 1
    model: str = ''
    generated_at: datetime | None = None
    #: Null means the answer only leaves by a refresh.
    expires_at: datetime | None = None

    def is_current(self, schema_version: int, now: datetime | None = None) -> bool:
        if self.schema_version != schema_version:
            return False
        if self.expires_at is None:
            return True
        return self.expires_at > (now or datetime.now(UTC))


@dataclass(eq=False, kw_only=True)
class AIRun:
    """One call to a provider, whatever asked for it.

    Every call is recorded, including the ones behind no registered feature —
    the recommended-portfolio extraction is a paid call too. That is why the
    feature is optional here and the label is not.
    """

    id: UUID | None = None
    feature_id: int | None = None
    prompt_version_id: int | None = None
    label: str
    provider: str = ''
    model: str = ''
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0
    status: str = AIRunStatus.SUCCESS
    error: str | None = None
    trace_id: str | None = None
    created_at: datetime | None = None
