from collections.abc import Sequence
from dataclasses import dataclass, replace

from app.config.logger import logger
from app.infra.ai.provider import AIGenerationRequest, AIGenerationResult, AIProvider
from app.infra.exceptions import IntegrationError

#: A provider that refuses for lack of funds answers 402. Everything else worth
#: moving on for already arrives as ``retryable``: a timeout, an unreachable
#: host, a spent rate limit or quota.
PAYMENT_REQUIRED = 402


@dataclass(frozen=True)
class ProviderLink:
    name: str
    provider: AIProvider
    #: The model families this link answers for. A request naming one of them
    #: starts here, whatever order the chain was declared in — the model is
    #: chosen in the admin, and it is what decides who answers.
    model_prefixes: tuple[str, ...]

    def owns(self, model: str | None) -> bool:
        return bool(model) and model.startswith(self.model_prefixes)


class FallbackAIProvider:
    """One provider made of several, tried in order.

    It moves on when a provider could not answer — timeout, unreachable, rate
    limited, out of quota — and never when it answered badly. A response that
    fails its schema is a prompt defect, and asking a second model produces the
    same defect at twice the price.

    The model travels only to the link that owns it. Handing `gpt-4o` to the
    next provider would fail for a reason that has nothing to do with why the
    first one did, so a fallen-through request asks each link for its own
    default model instead.
    """

    def __init__(self, links: Sequence[ProviderLink]):
        if not links:
            raise ValueError('FallbackAIProvider needs at least one provider')
        self._links = tuple(links)

    async def generate(self, request: AIGenerationRequest) -> AIGenerationResult:
        links = self._order(request.model)
        last_error = IntegrationError(provider='ai', retryable=True)

        for link in links:
            attempt = request if link.owns(request.model) else replace(request, model=None)
            try:
                return await link.provider.generate(attempt)
            except IntegrationError as error:
                if not self._should_move_on(error):
                    raise
                last_error = error
                logger.warning(
                    f'🔁 provider {link.name} não respondeu '
                    f'({type(error).__name__}); tentando o próximo'
                )

        raise last_error

    def _order(self, model: str | None) -> tuple[ProviderLink, ...]:
        owner = next((link for link in self._links if link.owns(model)), None)
        if owner is None:
            return self._links
        return (owner, *(link for link in self._links if link is not owner))

    @staticmethod
    def _should_move_on(error: IntegrationError) -> bool:
        return error.retryable or error.status_code == PAYMENT_REQUIRED

    async def aclose(self) -> None:
        for link in self._links:
            await link.provider.aclose()
