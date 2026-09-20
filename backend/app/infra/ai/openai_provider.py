import base64
import time

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    OpenAIError,
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

PROVIDER = 'openai'
SERVER_ERROR_STATUS = 500

DEFAULT_MODEL = 'gpt-4o-mini'

# Modelos de raciocínio recusam `temperature` com 400: a amostragem é decisão
# deles, não de quem chama. O campo continua existindo no editor de prompt
# porque os outros modelos o usam, então quem descarta é aqui — mandar assim
# mesmo transforma a troca de modelo em erro na cara de quem só queria trocar
# o modelo.
REASONING_MODEL_PREFIXES = ('gpt-5', 'o1', 'o3', 'o4')


class OpenAIProvider:
    def __init__(self, model: str = DEFAULT_MODEL):
        self._client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = model

    async def generate(self, request: AIGenerationRequest) -> AIGenerationResult:
        model = request.model or self.model
        kwargs = self._build_kwargs(request, model)
        started = time.monotonic()

        try:
            if request.output_schema is not None:
                response = await self._client.responses.parse(
                    text_format=request.output_schema, **kwargs
                )
            else:
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

        latency_ms = int((time.monotonic() - started) * 1000)
        if not response.output_text:
            raise IntegrationBadResponse(
                self._empty_response_message(response, model),
                provider=PROVIDER,
                context={'reason': 'empty response', 'model': model},
            )

        input_tokens, output_tokens = self._usage(response)
        return AIGenerationResult(
            text=response.output_text,
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
            'input': cls._build_input(request),
            'store': False,
        }
        if cls._accepts_temperature(model):
            kwargs['temperature'] = request.temperature
        if request.system:
            kwargs['instructions'] = request.system
        if request.max_output_tokens is not None:
            kwargs['max_output_tokens'] = request.max_output_tokens
        if request.web_search:
            kwargs['tools'] = [{'type': 'web_search'}]
        # The schema path goes through ``responses.parse``, which builds the
        # strict json_schema from the model itself. Setting a format here too
        # would be the same instruction twice, and the SDK refuses it.
        if request.json_output and request.output_schema is None:
            kwargs['text'] = {'format': {'type': 'json_object'}}
        return kwargs

    @staticmethod
    def _accepts_temperature(model: str) -> bool:
        return not model.startswith(REASONING_MODEL_PREFIXES)

    @classmethod
    def _empty_response_message(cls, response, model: str) -> str:
        """Por que não veio texto — a resposta diz, e isso se perdia aqui.

        O caso que motivou: um modelo de raciocínio gasta o teto de saída
        pensando antes de escrever. A resposta volta `incomplete` por
        `max_output_tokens`, sem um caractere visível, e "empty response"
        mandava procurar defeito no prompt — que estava certo. O teto é campo
        do editor de prompt, então dizer o número faz a mensagem apontar para
        onde se conserta.
        """
        status = getattr(response, 'status', None)
        reason = getattr(getattr(response, 'incomplete_details', None), 'reason', None)

        if reason == 'max_output_tokens':
            cap = getattr(response, 'max_output_tokens', None)
            reasoning = cls._reasoning_tokens(response)
            spent = f', {reasoning} deles raciocinando' if reasoning else ''
            return (
                f'{model} gastou o teto de {cap} tokens de saída{spent} '
                f'e não sobrou resposta: aumente o máximo de tokens de saída '
                f'da versão do prompt'
            )
        if reason == 'content_filter':
            return f'{model} interrompeu a resposta no filtro de conteúdo'
        return f'{model} respondeu sem texto (status {status})'

    @staticmethod
    def _reasoning_tokens(response) -> int:
        details = getattr(getattr(response, 'usage', None), 'output_tokens_details', None)
        return getattr(details, 'reasoning_tokens', 0) or 0

    @classmethod
    def _build_input(cls, request: AIGenerationRequest) -> str | list[dict]:
        """The prompt alone, or the prompt and the documents it refers to.

        A request without files keeps the bare string the Responses API takes,
        so the common call is unchanged. Files force the message form, since
        that is the only place a document can be attached.
        """
        if not request.files:
            return request.prompt
        content: list[dict] = [{'type': 'input_text', 'text': request.prompt}]
        content.extend(cls._file_part(file) for file in request.files)
        return [{'role': 'user', 'content': content}]

    @staticmethod
    def _file_part(file: AIFileInput) -> dict:
        encoded = base64.b64encode(file.content).decode('ascii')
        return {
            'type': 'input_file',
            'filename': file.filename,
            'file_data': f'data:{file.media_type};base64,{encoded}',
        }

    @staticmethod
    def _usage(response) -> tuple[int, int]:
        """Tokens as the provider counted them, or zero when it said nothing.

        Zero is honest here: it reads as "no cost recorded", and inventing a
        count from the prompt length would put a number nobody measured into
        the usage screen.
        """
        usage = getattr(response, 'usage', None)
        if usage is None:
            return 0, 0
        return getattr(usage, 'input_tokens', 0) or 0, getattr(usage, 'output_tokens', 0) or 0

    @staticmethod
    def _citations(response) -> tuple[Citation, ...]:
        """The URLs the web search actually fetched, deduplicated in order.

        Read off the annotations rather than out of the answer, so that a
        caller can tell a source the model consulted from one it wrote down.
        """
        seen: dict[str, Citation] = {}
        for item in getattr(response, 'output', None) or ():
            for part in getattr(item, 'content', None) or ():
                for annotation in getattr(part, 'annotations', None) or ():
                    if getattr(annotation, 'type', None) != 'url_citation':
                        continue
                    url = getattr(annotation, 'url', '')
                    if url and url not in seen:
                        seen[url] = Citation(url=url, title=getattr(annotation, 'title', '') or '')
        return tuple(seen.values())

    async def aclose(self) -> None:
        await self._client.close()
