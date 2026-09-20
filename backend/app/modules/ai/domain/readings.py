from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class AIArtifactReading:
    """One answer, as a caller receives it.

    It carries where it came from as much as what it says. A card shows the
    generation date because on a manually-refreshed feature that date is the
    only thing telling a reader whether to ask for a new one, and the admin
    shows the tokens and the cost because a run that produced nothing visible
    still spent money.

    ``from_cache`` distinguishes a read from a generation: the two are the same
    payload and cost very different things.
    """

    feature_key: str
    payload: dict[str, Any]
    schema_version: int
    model: str
    generated_at: datetime
    expires_at: datetime | None
    prompt_version: int
    from_cache: bool
    provider: str = ''
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: int = 0
