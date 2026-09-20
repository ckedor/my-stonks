from typing import Protocol

from app.config.logger import logger
from app.config.settings import settings
from app.infra.ai.provider import AIGenerationRequest, AIGenerationResult

#: The one module in the application that imports Langfuse. Everything above it
#: speaks this Protocol, so replacing the sink — or dropping it — touches this
#: file and nothing else.


class AITracer(Protocol):
    def record(
        self,
        request: AIGenerationRequest,
        result: AIGenerationResult | None,
        *,
        cost_usd: float,
        error: str | None = None,
    ) -> str | None:
        """Send one generation to the trace sink and return its trace id."""
        ...

    def flush(self) -> None: ...


class NullTracer:
    """What runs when Langfuse is not configured, which is the default.

    Tracing is optional infrastructure, on the same terms as the cache: an
    unreachable sink makes a call untraced, never failed.
    """

    def record(self, request, result, *, cost_usd: float, error: str | None = None) -> str | None:
        return None

    def flush(self) -> None:
        return None


class LangfuseTracer:
    def __init__(self, client) -> None:
        self._client = client

    def record(
        self,
        request: AIGenerationRequest,
        result: AIGenerationResult | None,
        *,
        cost_usd: float,
        error: str | None = None,
    ) -> str | None:
        trace = request.trace
        try:
            generation = self._client.start_observation(
                name=trace.label if trace else 'ai.generate',
                as_type='generation',
                input={'system': request.system, 'prompt': request.prompt},
                output=result.text if result else None,
                model=result.model if result else request.model,
                model_parameters={
                    'temperature': request.temperature,
                    'max_output_tokens': request.max_output_tokens,
                    'web_search': request.web_search,
                },
                usage_details=(
                    {'input': result.input_tokens, 'output': result.output_tokens}
                    if result
                    else None
                ),
                cost_details={'total': cost_usd} if result else None,
                metadata=self._metadata(request, result),
                level='ERROR' if error else 'DEFAULT',
                status_message=error,
            )
            trace_id = generation.trace_id
            generation.end()
        except Exception:
            # A trace that fails to leave the process must not take the answer
            # with it: the call already happened and was already paid for.
            logger.exception('❌ falha ao enviar trace para o Langfuse')
            return None
        return trace_id

    @staticmethod
    def _metadata(request: AIGenerationRequest, result: AIGenerationResult | None) -> dict:
        trace = request.trace
        return {
            'feature_id': trace.feature_id if trace else None,
            'prompt_version_id': trace.prompt_version_id if trace else None,
            'user_id': trace.user_id if trace else None,
            'provider': result.provider if result else None,
            'citations': [citation.url for citation in result.citations] if result else [],
        }

    def flush(self) -> None:
        try:
            self._client.flush()
        except Exception:
            logger.exception('❌ falha ao esvaziar a fila do Langfuse')


def build_tracer() -> AITracer:
    """The Langfuse tracer when it is configured, a no-op otherwise."""
    if not (settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY):
        return NullTracer()
    try:
        from langfuse import Langfuse

        client = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_HOST,
        )
    except Exception:
        logger.exception('❌ não foi possível inicializar o Langfuse; seguindo sem trace')
        return NullTracer()
    return LangfuseTracer(client)
