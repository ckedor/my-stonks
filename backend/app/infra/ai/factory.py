from functools import lru_cache

from app.config.settings import settings
from app.infra.ai.anthropic_provider import AnthropicProvider
from app.infra.ai.fallback_provider import FallbackAIProvider, ProviderLink
from app.infra.ai.openai_provider import OpenAIProvider
from app.infra.ai.provider import AIProvider
from app.infra.ai.recording_provider import RecordingAIProvider
from app.infra.ai.tracing import build_tracer
from app.infra.db.unit_of_work import UnitOfWork

OPENAI_MODEL_PREFIXES = ('gpt-', 'o1', 'o3', 'o4', 'chatgpt')
ANTHROPIC_MODEL_PREFIXES = ('claude-',)


def _links() -> list[ProviderLink]:
    """The chain, in the order it is tried when the requested model owns none.

    A provider without a key is left out rather than added and skipped: an
    empty key produces a 401, which is not a reason to fall through — it is a
    configuration mistake, and it should look like one.
    """
    links: list[ProviderLink] = []
    if settings.OPENAI_API_KEY:
        links.append(
            ProviderLink(
                name='openai',
                provider=OpenAIProvider(),
                model_prefixes=OPENAI_MODEL_PREFIXES,
            )
        )
    if settings.ANTHROPIC_API_KEY:
        links.append(
            ProviderLink(
                name='anthropic',
                provider=AnthropicProvider(),
                model_prefixes=ANTHROPIC_MODEL_PREFIXES,
            )
        )
    if not links:
        # Nothing is configured. Build the OpenAI link anyway so a call fails
        # at the provider with its own message, instead of at composition with
        # one about a chain.
        links.append(
            ProviderLink(
                name='openai',
                provider=OpenAIProvider(),
                model_prefixes=OPENAI_MODEL_PREFIXES,
            )
        )
    return links


@lru_cache(maxsize=1)
def get_ai_provider() -> AIProvider:
    """The process-wide provider stack, reusing its HTTP connection pools.

    Recording wraps the chain rather than the other way round, so a request
    that fell through two providers is one run and one trace — the fact that
    the first refused is in the answer's provider, not in a second row.
    """
    return RecordingAIProvider(
        FallbackAIProvider(_links()),
        uow_factory=UnitOfWork,
        tracer=build_tracer(),
        daily_cost_limit_usd=settings.AI_DAILY_COST_LIMIT_USD,
    )


async def close_ai_provider() -> None:
    """Release resources held by the process-wide provider, if initialized."""
    if get_ai_provider.cache_info().currsize:
        provider = get_ai_provider()
        await provider.aclose()
        get_ai_provider.cache_clear()
