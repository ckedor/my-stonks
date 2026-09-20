import base64
import time

from anthropic import (
    AnthropicError,
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncAnthropic,
    RateLimitError,
)

from app.config.settings import settings
from app.infra.ai.provider import (
    AIFileInput,
    AIGenerationRequest,
    AIGenerationResult,
    Citation,
)
from app.infra.exceptions import (
    IntegrationBadResponse,
    IntegrationError,
    IntegrationRateLimited,
    IntegrationTimeout,
    IntegrationUnavailable,
)

PROVIDER = 'anthropic'
SERVER_ERROR_STATUS = 500

DEFAULT_MODEL = 'claude-sonnet-5'
#: Anthropic requires a token ceiling on every call, unlike the Responses API.
#: A request that names none gets this one rather than failing.
DEFAULT_MAX_TOKENS = 4096

WEB_SEARCH_TOOL = {'type': 'web_search_20260318', 'name': 'web_search'}


class AnthropicProvider:
    """The second link of the fallback chain.

    It answers the same contract as the OpenAI one and maps its own SDK's
    failures onto the same integration vocabulary, so the chain above it can
    decide to move on without knowing which provider refused.
    """

    def __init__(self, model: str = DEFAULT_MODEL):
        self._client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self.model = model

    async def generate(self, request: AIGenerationRequest) -> AIGenerationResult:
        model = request.model or self.model
        kwargs = self._build_kwargs(request, model)
        started = time.monotonic()

        try:
            response = await self._client.messages.create(**kwargs)
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
        except AnthropicError as e:
            raise IntegrationError(provider=PROVIDER) from e

        latency_ms = int((time.monotonic() - started) * 1000)
        text = self._text(response)
        if not text:
            raise IntegrationBadResponse(provider=PROVIDER, context={'reason': 'empty response'})

        input_tokens, output_tokens = self._usage(response)
        return AIGenerationResult(
            text=text,
            model=model,
            provider=PROVIDER,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=latency_ms,
            citations=self._citations(response),
        )

    @classmethod
    def _build_kwargs(cls, request: AIGenerationRequest, model: str) -> dict:
        kwargs: dict = {
            'model': model,
            'max_tokens': request.max_output_tokens or DEFAULT_MAX_TOKENS,
            'messages': [{'role': 'user', 'content': cls._build_content(request)}],
            'temperature': request.temperature,
        }
        if request.system:
            kwargs['system'] = request.system
        if request.web_search:
            kwargs['tools'] = [WEB_SEARCH_TOOL]
        if request.output_schema is not None:
            kwargs['output_config'] = {
                'format': {
                    'type': 'json_schema',
                    'schema': request.output_schema.model_json_schema(),
                }
            }
        return kwargs

    @classmethod
    def _build_content(cls, request: AIGenerationRequest) -> list[dict]:
        content: list[dict] = [{'type': 'text', 'text': request.prompt}]
        content.extend(cls._file_part(file) for file in request.files)
        return content

    @staticmethod
    def _file_part(file: AIFileInput) -> dict:
        encoded = base64.b64encode(file.content).decode('ascii')
        block_type = 'document' if file.media_type == 'application/pdf' else 'image'
        return {
            'type': block_type,
            'source': {'type': 'base64', 'media_type': file.media_type, 'data': encoded},
        }

    @staticmethod
    def _text(response) -> str:
        parts = [
            block.text
            for block in getattr(response, 'content', None) or ()
            if getattr(block, 'type', None) == 'text' and getattr(block, 'text', None)
        ]
        return ''.join(parts)

    @staticmethod
    def _usage(response) -> tuple[int, int]:
        usage = getattr(response, 'usage', None)
        if usage is None:
            return 0, 0
        return getattr(usage, 'input_tokens', 0) or 0, getattr(usage, 'output_tokens', 0) or 0

    @staticmethod
    def _citations(response) -> tuple[Citation, ...]:
        """The pages the web-search tool actually returned, in order.

        They arrive as result blocks rather than as annotations on the text,
        which is the one place this provider's shape differs from the other's.
        """
        seen: dict[str, Citation] = {}
        for block in getattr(response, 'content', None) or ():
            if getattr(block, 'type', None) != 'web_search_tool_result':
                continue
            for result in getattr(block, 'content', None) or ():
                url = getattr(result, 'url', '')
                if url and url not in seen:
                    seen[url] = Citation(url=url, title=getattr(result, 'title', '') or '')
        return tuple(seen.values())

    async def aclose(self) -> None:
        await self._client.close()
