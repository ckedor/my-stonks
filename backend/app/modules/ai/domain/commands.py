from dataclasses import dataclass


@dataclass(frozen=True)
class UpdateAIFeatureCommand:
    feature_key: str
    name: str
    description: str
    enabled: bool
    freshness: str
    ttl_hours: int | None


@dataclass(frozen=True)
class CreateAIPromptVersionCommand:
    """A prompt is never edited, only succeeded.

    There is no update command here on purpose: an artifact points at the exact
    version that produced it, so rewriting a version's text would silently
    change the meaning of every answer already stored under it.
    """

    feature_key: str
    system: str
    template: str
    model: str
    temperature: float
    max_output_tokens: int | None
    web_search: bool
    notes: str
    activate: bool
