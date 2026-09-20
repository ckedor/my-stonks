from dataclasses import dataclass, field
from typing import Protocol

from pydantic import BaseModel


@dataclass(frozen=True)
class AIFileInput:
    """A document handed to the model alongside the prompt.

    The bytes travel to the provider as they came off the wire. Turning a PDF
    into text before the model sees it is a decision the caller does not get to
    make halfway: a research report is a two-column layout with tables in it,
    and a text extraction of one arrives shuffled.
    """

    filename: str
    media_type: str
    content: bytes


@dataclass(frozen=True)
class TraceContext:
    """Who a call is for, so its cost can be attributed to something.

    It travels on the request because the provider must not know what an AI
    feature is: the recording layer reads these fields to write the run, and
    the tracing layer to name the trace. A call without one still happens and
    is still recorded, under its label alone.
    """

    #: What to call this call when there is no registered feature behind it —
    #: the recommended-portfolio extraction is a paid call and not a feature.
    label: str
    feature_id: int | None = None
    prompt_version_id: int | None = None
    user_id: int | None = None


@dataclass(frozen=True)
class AIGenerationRequest:
    prompt: str
    system: str = ''
    model: str | None = None
    temperature: float = 0.2
    max_output_tokens: int | None = None
    files: tuple[AIFileInput, ...] = ()
    #: Ask the provider to answer with a JSON document of no declared shape.
    #: It constrains the syntax of the answer, not its structure: the caller
    #: still validates. Prefer ``output_schema``, which constrains both.
    json_output: bool = False
    #: Constrain the answer to this model's JSON schema. Providers enforce it
    #: during generation rather than after, so a missing key stops being a
    #: failure mode. The caller still validates: enforcement covers the shape,
    #: never the content.
    output_schema: type[BaseModel] | None = None
    #: Let the model search the web. What it finds comes back in
    #: ``AIGenerationResult.citations`` as the URLs the provider actually
    #: fetched, which is what makes a cited source checkable.
    web_search: bool = False
    trace: TraceContext | None = None


@dataclass(frozen=True)
class Citation:
    """One source the provider actually fetched, as it reported it.

    These are not the sources the model wrote into its answer. The difference
    is the whole point: a URL in the answer that is absent here was invented.
    """

    url: str
    title: str = ''


@dataclass(frozen=True)
class AIGenerationResult:
    text: str
    model: str
    provider: str = ''
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: int = 0
    citations: tuple[Citation, ...] = field(default_factory=tuple)


class AIProvider(Protocol):
    async def generate(self, request: AIGenerationRequest) -> AIGenerationResult:
        """Generate text without exposing provider-specific response types."""
        ...

    async def aclose(self) -> None:
        """Release provider resources such as HTTP connection pools."""
        ...
