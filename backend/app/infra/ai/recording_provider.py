from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from app.config.logger import logger
from app.core.exceptions import BusinessRuleError
from app.infra.ai.provider import AIGenerationRequest, AIGenerationResult, AIProvider
from app.infra.ai.tracing import AITracer
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.exceptions import IntegrationError
from app.modules.ai.domain.entities import AIRun
from app.modules.ai.domain.enums import AIRunStatus
from app.modules.ai.domain.pricing import calculate_cost_usd


class AIBudgetExceeded(BusinessRuleError):
    default_message = 'O teto de gasto diário com IA foi atingido'


class RecordingAIProvider:
    """The outermost link: what makes a call countable before it is made.

    It sits at the provider boundary rather than inside a feature's service on
    purpose. Everything that reaches a model goes through here — a feature, a
    scheduled refresh, the recommended-portfolio extraction — so nothing can
    spend the key without leaving a row behind, and no future caller has to
    remember to record itself.

    Recording is best effort in one direction only. A run that fails to be
    written is logged and the answer still returns, because the call already
    happened; but the budget is checked *before* the call, where refusing still
    saves the money.
    """

    def __init__(
        self,
        inner: AIProvider,
        *,
        uow_factory: Callable[[], UnitOfWork],
        tracer: AITracer,
        daily_cost_limit_usd: float,
    ):
        self._inner = inner
        self._uow_factory = uow_factory
        self._tracer = tracer
        self._daily_cost_limit_usd = daily_cost_limit_usd

    async def generate(self, request: AIGenerationRequest) -> AIGenerationResult:
        await self._assert_within_budget()

        try:
            result = await self._inner.generate(request)
        except IntegrationError as error:
            trace_id = self._tracer.record(request, None, cost_usd=0.0, error=str(error))
            await self._write(self._failed_run(request, error, trace_id, provider=error.provider))
            raise

        cost_usd = calculate_cost_usd(result.model, result.input_tokens, result.output_tokens)
        trace_id = self._tracer.record(request, result, cost_usd=cost_usd)
        await self._write(self._successful_run(request, result, cost_usd, trace_id))
        return result

    async def _assert_within_budget(self) -> None:
        """Refuse before spending, never after.

        An API key has no ceiling of its own, and a loop regenerating the same
        artifact would run until someone noticed the invoice.
        """
        if self._daily_cost_limit_usd <= 0:
            return
        try:
            async with self._uow_factory() as uow:
                spent = await uow.ai.cost_since(datetime.now(UTC) - timedelta(days=1))
        except Exception:
            # An unreadable ledger must not become an outage. It is logged, and
            # the call proceeds: the cap protects against a runaway loop, not
            # against a database that is already down.
            logger.exception('❌ não foi possível ler o gasto de IA das últimas 24h')
            return
        if spent >= self._daily_cost_limit_usd:
            raise AIBudgetExceeded(
                f'Gasto de IA nas últimas 24h (US$ {spent:.2f}) atingiu o teto de '
                f'US$ {self._daily_cost_limit_usd:.2f}'
            )

    @staticmethod
    def _successful_run(
        request: AIGenerationRequest,
        result: AIGenerationResult,
        cost_usd: float,
        trace_id: str | None,
    ) -> AIRun:
        trace = request.trace
        return AIRun(
            feature_id=trace.feature_id if trace else None,
            prompt_version_id=trace.prompt_version_id if trace else None,
            label=trace.label if trace else 'ai.generate',
            provider=result.provider,
            model=result.model,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            cost_usd=cost_usd,
            latency_ms=result.latency_ms,
            status=AIRunStatus.SUCCESS,
            trace_id=trace_id,
        )

    @staticmethod
    def _failed_run(
        request: AIGenerationRequest,
        error: IntegrationError,
        trace_id: str | None,
        *,
        provider: str,
    ) -> AIRun:
        trace = request.trace
        return AIRun(
            feature_id=trace.feature_id if trace else None,
            prompt_version_id=trace.prompt_version_id if trace else None,
            label=trace.label if trace else 'ai.generate',
            provider=provider,
            model=request.model or '',
            status=AIRunStatus.FAILURE,
            error=f'{type(error).__name__}: {error}',
            trace_id=trace_id,
        )

    async def _write(self, run: AIRun) -> None:
        try:
            async with self._uow_factory() as uow:
                await uow.ai.record_run(run)
                await uow.commit()
        except Exception:
            logger.exception('❌ não foi possível registrar a execução de IA')

    async def aclose(self) -> None:
        self._tracer.flush()
        await self._inner.aclose()
