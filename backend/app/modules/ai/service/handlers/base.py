from abc import ABC, abstractmethod
from typing import Any, ClassVar, Generic, TypeVar

from pydantic import BaseModel

from app.infra.ai.provider import Citation
from app.modules.ai.domain.enums import AIFeatureKey

TInput = TypeVar('TInput', bound=BaseModel)


class AIFeatureHandler(ABC, Generic[TInput]):
    """What a feature knows that the generic machinery cannot.

    The service around it reads the artifact, renders the prompt, calls the
    provider and writes the row — all of that is the same for every feature.
    What differs is three things, and they are exactly what a handler declares:
    the shape of its input, the shape of its answer, and the data the
    application has to assemble before a model can say anything useful.

    That last one is what the first version of this module was missing. It sent
    a ticker and nothing else, so the model answered out of training memory —
    no price, no position, no registry. Everything a feature states about the
    application's own data now arrives through ``build_context``.
    """

    feature_key: ClassVar[AIFeatureKey]
    input_model: ClassVar[type[BaseModel]]
    output_model: ClassVar[type[BaseModel]]
    #: Bumped when ``output_model`` changes shape. Artifacts written under an
    #: older version are ignored on read rather than parsed into a failure.
    schema_version: ClassVar[int] = 1
    #: The names a prompt template of this feature may use. Enforced when a
    #: prompt version is saved, not when it runs.
    context_keys: ClassVar[frozenset[str]] = frozenset()

    @abstractmethod
    async def build_context(self, input: TInput) -> dict[str, Any]:
        """Assemble, from the application's own records, everything the prompt
        may refer to. Every number a feature states comes from here."""

    async def scheduled_inputs(self) -> list[TInput]:
        """The inputs a scheduled run refreshes.

        Empty — the default — means the feature only ever runs on demand. A
        feature that returns a list here is refreshed by ``run_ai_feature``
        when the beat calls it with no input.
        """
        return []

    def refine(self, output: BaseModel, citations: tuple[Citation, ...]) -> BaseModel:
        """Last chance to drop what the model wrote but could not have known.

        Schema enforcement guarantees the shape and says nothing about the
        content, so a feature that cites the web checks the citations it was
        actually given. The default keeps the answer as it came.
        """
        return output
