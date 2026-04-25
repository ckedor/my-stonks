from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import ClassVar, Generic, TypeVar

from app.modules.ai.domain.feature_keys import AIFeatureKey
from app.modules.ai.domain.inputs import AIArtifactInput

TInput = TypeVar('TInput', bound=AIArtifactInput)


@dataclass(frozen=True)
class AIResponse:
    summary: str
    payload: dict
    model: str | None


class AIArtifactHandler(ABC, Generic[TInput]):
    """Strategy interface for generating one AI artifact feature."""

    feature_key: ClassVar[AIFeatureKey]
    input_schema: ClassVar[type[AIArtifactInput]]

    def __init__(self, session):
        self.session = session

    @abstractmethod
    async def generate(self, input: TInput) -> AIResponse:
        ...
