from typing import Annotated

from fastapi import APIRouter, Body, Depends, Query

from app.composition.portfolio import get_portfolio_transaction_service
from app.entrypoints.worker.task_runner import run_task_by_name
from app.modules.portfolio.api.access import OwnedPortfolioId, PortfolioGuard
from app.modules.portfolio.service.portfolio_transaction_service import (
    PortfolioTransactionService,
)

from .schema import Transaction

#: Dispatched by name so this router keeps no import of the task, which would
#: pull the consolidation service and its dependencies into the HTTP process.
RECALCULATE_ASSET_POSITION_TASK = 'recalculate_asset_position'

router = APIRouter(prefix='/transaction', tags=['Portfolio Transaction'])


@router.get('')
async def list_transactions(
    portfolio_id: OwnedPortfolioId,
    service: Annotated[PortfolioTransactionService, Depends(get_portfolio_transaction_service)],
    asset_id: Annotated[int | None, Query()] = None,
    asset_type_ids: Annotated[list[int] | None, Query()] = None,
    currency_id: Annotated[int | None, Query()] = None,
):
    return await service.get_transactions(
        portfolio_id=portfolio_id,
        asset_id=asset_id,
        asset_types_ids=asset_type_ids,
        currency_id=currency_id,
    )


@router.post('')
async def create_transaction(
    transaction: Transaction,
    guard: PortfolioGuard,
    service: Annotated[PortfolioTransactionService, Depends(get_portfolio_transaction_service)],
):
    await guard(portfolios=[transaction.portfolio_id])
    await service.create_transaction(transaction.model_dump())
    run_task_by_name(
        RECALCULATE_ASSET_POSITION_TASK, transaction.portfolio_id, transaction.asset_id
    )
    return {'message': 'Transaction created'}


@router.put('/{transaction_id}')
async def update_transaction(
    transaction_id: int,
    transaction: dict,
    guard: PortfolioGuard,
    service: Annotated[PortfolioTransactionService, Depends(get_portfolio_transaction_service)],
):
    # A transação pode mudar de carteira: a de origem e a de destino são do dono.
    await guard(transactions=[transaction_id], portfolios=[transaction['portfolio_id']])
    transaction = {**transaction, 'id': transaction_id}
    old_portfolio_id, old_asset_id = await service.update_transaction(transaction)
    run_task_by_name(
        RECALCULATE_ASSET_POSITION_TASK, transaction['portfolio_id'], transaction['asset_id']
    )
    if (transaction['portfolio_id'], transaction['asset_id']) != (old_portfolio_id, old_asset_id):
        run_task_by_name(RECALCULATE_ASSET_POSITION_TASK, old_portfolio_id, old_asset_id)
    return {'message': 'Transaction updated'}


@router.delete('/{transaction_id}')
async def delete_transaction(
    transaction_id: int,
    guard: PortfolioGuard,
    portfolio_id: Annotated[int, Body()],
    asset_id: Annotated[int, Body()],
    service: Annotated[PortfolioTransactionService, Depends(get_portfolio_transaction_service)],
):
    await guard(transactions=[transaction_id], portfolios=[portfolio_id])
    await service.delete_transaction(transaction_id)
    run_task_by_name(RECALCULATE_ASSET_POSITION_TASK, portfolio_id, asset_id)
    return {'message': 'Transaction deleted'}
