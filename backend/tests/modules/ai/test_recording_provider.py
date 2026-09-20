"""Nada chega a um modelo sem deixar linha, e nada passa do teto de gasto.

O registro fica na fronteira do provider, e não no service da feature, para que
nenhum chamador futuro precise lembrar de se instrumentar.
"""

from dataclasses import dataclass, field

import pytest

from app.infra.ai.provider import AIGenerationRequest, AIGenerationResult, TraceContext
from app.infra.ai.recording_provider import AIBudgetExceeded, RecordingAIProvider
from app.infra.ai.tracing import NullTracer
from app.infra.exceptions import IntegrationRateLimited
from app.modules.ai.domain.enums import AIRunStatus
from tests.fakes import FakeUnitOfWork

pytestmark = pytest.mark.unit


@dataclass
class FakeProvider:
    error: Exception | None = None
    closed: bool = False

    async def generate(self, request):
        if self.error is not None:
            raise self.error
        return AIGenerationResult(
            text='{}',
            model='gpt-4o',
            provider='openai',
            input_tokens=1_000,
            output_tokens=500,
            latency_ms=1234,
        )

    async def aclose(self) -> None:
        self.closed = True


@dataclass
class FakeAIRepository:
    spent: float = 0.0
    runs: list = field(default_factory=list)

    async def cost_since(self, moment):
        return self.spent

    async def record_run(self, run):
        self.runs.append(run)


def _provider(inner, repository, limit=5.0):
    uow = FakeUnitOfWork(ai=repository)
    return RecordingAIProvider(
        inner,
        uow_factory=lambda: uow,
        tracer=NullTracer(),
        daily_cost_limit_usd=limit,
    )


def _request():
    return AIGenerationRequest(
        prompt='oi', model='gpt-4o', trace=TraceContext(label='asset_description', feature_id=1)
    )


async def test_a_successful_call_is_recorded_with_its_tokens_and_cost():
    repository = FakeAIRepository()

    await _provider(FakeProvider(), repository).generate(_request())

    run = repository.runs[0]
    assert run.label == 'asset_description'
    assert run.feature_id == 1
    assert (run.input_tokens, run.output_tokens) == (1_000, 500)
    assert run.latency_ms == 1234
    assert run.status == AIRunStatus.SUCCESS
    # gpt-4o: 1000 in a 2.50/Mtok + 500 out a 10.00/Mtok
    assert run.cost_usd == pytest.approx(0.0075)


async def test_a_failed_call_is_recorded_too():
    repository = FakeAIRepository()
    inner = FakeProvider(error=IntegrationRateLimited(provider='openai'))

    with pytest.raises(IntegrationRateLimited):
        await _provider(inner, repository).generate(_request())

    run = repository.runs[0]
    assert run.status == AIRunStatus.FAILURE
    assert 'IntegrationRateLimited' in run.error


async def test_a_call_with_no_feature_behind_it_is_still_recorded():
    """A extração de carteira recomendada gasta dinheiro e não é uma feature."""
    repository = FakeAIRepository()
    request = AIGenerationRequest(
        prompt='oi', trace=TraceContext(label='recommended_portfolio_extraction')
    )

    await _provider(FakeProvider(), repository).generate(request)

    run = repository.runs[0]
    assert run.feature_id is None
    assert run.label == 'recommended_portfolio_extraction'


async def test_spending_over_the_ceiling_refuses_before_calling_the_model():
    repository = FakeAIRepository(spent=5.5)
    inner = FakeProvider(error=AssertionError('o modelo não devia ter sido chamado'))

    with pytest.raises(AIBudgetExceeded):
        await _provider(inner, repository, limit=5.0).generate(_request())

    assert repository.runs == []


async def test_a_ceiling_of_zero_disables_the_check():
    repository = FakeAIRepository(spent=1_000.0)

    await _provider(FakeProvider(), repository, limit=0).generate(_request())

    assert repository.runs[0].status == AIRunStatus.SUCCESS


async def test_an_unwritable_ledger_does_not_take_the_answer_with_it():
    """Registrar é melhor-esforço: a chamada já aconteceu e já foi paga."""

    class Broken:
        async def cost_since(self, moment):
            return 0.0

        async def record_run(self, run):
            raise RuntimeError('banco fora')

    result = await _provider(FakeProvider(), Broken()).generate(_request())

    assert result.model == 'gpt-4o'
