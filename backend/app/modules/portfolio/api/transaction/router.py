from fastapi import APIRouter, Body, Depends, Query

from app.composition.portfolio import get_portfolio_transaction_service
from app.entrypoints.worker.task_runner import run_task_by_name
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
    portfolio_id: int = Query(...),
    asset_id: int = Query(None),
    asset_type_ids: list[int] | None = Query(None),
    currency_id: int | None = Query(None),
    service: PortfolioTransactionService = Depends(get_portfolio_transaction_service),
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
    service: PortfolioTransactionService = Depends(get_portfolio_transaction_service),
):
    await service.create_transaction(transaction.model_dump())
    run_task_by_name(
        RECALCULATE_ASSET_POSITION_TASK, transaction.portfolio_id, transaction.asset_id
    )
    return {'message': 'Transaction created'}


@router.put('/{transaction_id}')
async def update_transaction(
    transaction_id: int,
    transaction: dict,
    service: PortfolioTransactionService = Depends(get_portfolio_transaction_service),
):
    transaction = {**transaction, 'id': transaction_id}
    old_portfolio_id = await service.update_transaction(transaction)
    run_task_by_name(
        RECALCULATE_ASSET_POSITION_TASK, transaction['portfolio_id'], transaction['asset_id']
    )
    if transaction['portfolio_id'] != old_portfolio_id:
        run_task_by_name(RECALCULATE_ASSET_POSITION_TASK, old_portfolio_id, transaction['asset_id'])
    return {'message': 'Transaction updated'}


@router.delete('/{transaction_id}')
async def delete_transaction(
    transaction_id: int,
    portfolio_id: int = Body(...),
    asset_id: int = Body(...),
    service: PortfolioTransactionService = Depends(get_portfolio_transaction_service),
):
    await service.delete_transaction(transaction_id)
    run_task_by_name(RECALCULATE_ASSET_POSITION_TASK, portfolio_id, asset_id)
    return {'message': 'Transaction deleted'}
