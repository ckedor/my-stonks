from functools import lru_cache

from app.config.settings import settings
from app.infra.exceptions import (
    IntegrationBadResponse,
    IntegrationError,
    IntegrationRateLimited,
    IntegrationTimeout,
    IntegrationUnavailable,
)
from app.modules.ai.domain.provider import (
    AIGenerationRequest,
    AIGenerationResult,
    AIProvider,
)
from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    OpenAIError,
    RateLimitError,
)

PROVIDER = 'openai'
SERVER_ERROR_STATUS = 500


class OpenAIProvider:
    def __init__(self, model: str = 'gpt-4o-mini'):
        self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = model

    async def generate(self, request: AIGenerationRequest) -> AIGenerationResult:
        model = request.model or self.model
        kwargs = {
            'model': model,
            'input': request.prompt,
            'temperature': request.temperature,
            'store': False,
        }

        if request.system:
            kwargs['instructions'] = request.system
        if request.max_output_tokens is not None:
            kwargs['max_output_tokens'] = request.max_output_tokens

        try:
            response = await self._client.responses.create(**kwargs)
        except APITimeoutError as e:
            raise IntegrationTimeout(provider=PROVIDER) from e
        except RateLimitError as e:
            raise IntegrationRateLimited(provider=PROVIDER, status_code=429) from e
        except APIConnectionError as e:
            raise IntegrationUnavailable(provider=PROVIDER) from e
        except APIStatusError as e:
            raise IntegrationError(
                provider=PROVIDER,
                status_code=e.status_code,
                retryable=e.status_code >= SERVER_ERROR_STATUS,
            ) from e
        except OpenAIError as e:
            raise IntegrationError(provider=PROVIDER) from e

        if not response.output_text:
            raise IntegrationBadResponse(
                provider=PROVIDER, context={'reason': 'empty response'}
            )
        return AIGenerationResult(text=response.output_text, model=model)

    async def aclose(self) -> None:
        await self._client.close()


@lru_cache(maxsize=1)
def get_ai_provider() -> AIProvider:
    """Return the process-wide AI provider and reuse its HTTP connection pool."""
    return OpenAIProvider()


async def close_ai_provider() -> None:
    """Release resources held by the process-wide provider, if initialized."""
    if get_ai_provider.cache_info().currsize:
        provider = get_ai_provider()
        await provider.aclose()
        get_ai_provider.cache_clear()
