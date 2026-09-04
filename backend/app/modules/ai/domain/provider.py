from dataclasses import dataclass
from typing import Protocol


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
class AIGenerationRequest:
    prompt: str
    system: str = ''
    model: str | None = None
    temperature: float = 0.2
    max_output_tokens: int | None = None
    files: tuple[AIFileInput, ...] = ()
    #: Ask the provider to answer with a JSON document. It constrains the
    #: shape of the answer, not its content: the caller still validates.
    json_output: bool = False


@dataclass(frozen=True)
class AIGenerationResult:
    text: str
    model: str


class AIProvider(Protocol):
    async def generate(self, request: AIGenerationRequest) -> AIGenerationResult:
        """Generate text without exposing provider-specific response types."""
        ...

    async def aclose(self) -> None:
        """Release provider resources such as HTTP connection pools."""
        ...
