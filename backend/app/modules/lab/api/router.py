from fastapi import APIRouter, Depends

from app.composition.lab import get_backtest_service, get_theoretical_portfolio_service
from app.modules.lab.api.schemas import (
    BacktestResponse,
    CompareBacktestsRequest,
    PresetResponse,
    RunBacktestRequest,
    SaveTheoreticalPortfolioRequest,
    TheoreticalPortfolioResponse,
)
from app.modules.lab.domain.commands import (
    CompareBacktestsCommand,
    RunBacktestCommand,
    SaveTheoreticalPortfolioCommand,
    TheoreticalPositionCommand,
)
from app.modules.lab.service.backtest_service import BacktestService
from app.modules.lab.service.theoretical_portfolio_service import TheoreticalPortfolioService
from app.modules.users.domain import User
from app.modules.users.views import current_active_user

router = APIRouter(tags=['Laboratório'], prefix='/lab')

theoretical_portfolio_router = APIRouter(prefix='/portfolio')
backtest_router = APIRouter(prefix='/backtest')


@router.get('/preset', response_model=list[PresetResponse])
async def list_presets(
    _: User = Depends(current_active_user),
    service: TheoreticalPortfolioService = Depends(get_theoretical_portfolio_service),
):
    """Os modelos que já vêm prontos. São código, não linhas de tabela."""
    return service.list_presets()


@theoretical_portfolio_router.get('', response_model=list[TheoreticalPortfolioResponse])
async def list_theoretical_portfolios(
    user: User = Depends(current_active_user),
    service: TheoreticalPortfolioService = Depends(get_theoretical_portfolio_service),
):
    return await service.list(user.id)


@theoretical_portfolio_router.get(
    '/{theoretical_portfolio_id}', response_model=TheoreticalPortfolioResponse
)
async def get_theoretical_portfolio(
    theoretical_portfolio_id: int,
    user: User = Depends(current_active_user),
    service: TheoreticalPortfolioService = Depends(get_theoretical_portfolio_service),
):
    return await service.get(theoretical_portfolio_id, user.id)


@theoretical_portfolio_router.post('', response_model=TheoreticalPortfolioResponse)
async def create_theoretical_portfolio(
    payload: SaveTheoreticalPortfolioRequest,
    user: User = Depends(current_active_user),
    service: TheoreticalPortfolioService = Depends(get_theoretical_portfolio_service),
):
    command = _save_command(payload)
    return await service.create(command, user.id)


@theoretical_portfolio_router.put(
    '/{theoretical_portfolio_id}', response_model=TheoreticalPortfolioResponse
)
async def update_theoretical_portfolio(
    theoretical_portfolio_id: int,
    payload: SaveTheoreticalPortfolioRequest,
    user: User = Depends(current_active_user),
    service: TheoreticalPortfolioService = Depends(get_theoretical_portfolio_service),
):
    command = _save_command(payload)
    return await service.update(theoretical_portfolio_id, command, user.id)


@theoretical_portfolio_router.delete('/{theoretical_portfolio_id}')
async def delete_theoretical_portfolio(
    theoretical_portfolio_id: int,
    user: User = Depends(current_active_user),
    service: TheoreticalPortfolioService = Depends(get_theoretical_portfolio_service),
):
    await service.delete(theoretical_portfolio_id, user.id)
    return {'message': 'Carteira teórica removida.'}


@backtest_router.post('', response_model=BacktestResponse)
async def run_backtest(
    payload: RunBacktestRequest,
    _: User = Depends(current_active_user),
    service: BacktestService = Depends(get_backtest_service),
):
    """Simula a alocação do corpo. Nada é persistido."""
    command = _run_command(payload)
    return await service.run(command)


@backtest_router.post('/comparison', response_model=list[BacktestResponse])
async def compare_backtests(
    payload: CompareBacktestsRequest,
    _: User = Depends(current_active_user),
    service: BacktestService = Depends(get_backtest_service),
):
    """Várias simulações lidas lado a lado.

    Atende os dois casos, porque são a mesma leitura: variar um parâmetro da
    mesma carteira, e comparar carteiras diferentes.
    """
    command = CompareBacktestsCommand(runs=[_run_command(run) for run in payload.runs])
    return await service.compare(command)


def _positions(payload) -> list[TheoreticalPositionCommand]:
    return [
        TheoreticalPositionCommand(
            weight=position.weight,
            asset_id=position.asset_id,
            series_id=position.series_id,
            fixed_income_type_id=position.fixed_income_type_id,
            rate=position.rate,
            label=position.label,
        )
        for position in payload.positions
    ]


def _save_command(payload: SaveTheoreticalPortfolioRequest) -> SaveTheoreticalPortfolioCommand:
    return SaveTheoreticalPortfolioCommand(
        name=payload.name,
        initial_amount=payload.initial_amount,
        contribution_amount=payload.contribution_amount,
        contribution_frequency=payload.contribution_frequency,
        rebalance_frequency=payload.rebalance_frequency,
        benchmark_id=payload.benchmark_id,
        positions=_positions(payload),
    )


def _run_command(payload: RunBacktestRequest) -> RunBacktestCommand:
    return RunBacktestCommand(
        positions=_positions(payload),
        currency=payload.currency,
        initial_amount=payload.initial_amount,
        contribution_amount=payload.contribution_amount,
        contribution_frequency=payload.contribution_frequency,
        rebalance_frequency=payload.rebalance_frequency,
        start_date=payload.start_date,
        years=payload.years,
        end_date=payload.end_date,
        benchmark_ids=payload.benchmark_ids,
        label=payload.label,
    )


router.include_router(theoretical_portfolio_router)
router.include_router(backtest_router)
