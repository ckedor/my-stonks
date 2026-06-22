from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class AIGenerationRequest:
    prompt: str
    system: str = ''
    model: str | None = None
    temperature: float = 0.2
    max_output_tokens: int | None = None


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
