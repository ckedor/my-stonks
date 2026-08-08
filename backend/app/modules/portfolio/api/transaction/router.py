from typing import List, Optional

from app.composition.portfolio import (
    get_portfolio_transaction_read_service,
    get_portfolio_transaction_write_service,
)
from app.entrypoints.worker.task_runner import run_task
from app.modules.portfolio.service.portfolio_transaction_service import (
    PortfolioTransactionService,
)
from app.modules.portfolio.tasks.recalculate_asset_position import (
    recalculate_position_asset,
)
from fastapi import APIRouter, Body, Depends, Query

from .schema import Transaction

router = APIRouter(prefix='/transaction', tags=['Portfolio Transaction'])


@router.get('')
async def list_transactions(
    portfolio_id: int = Query(...),
    asset_id: int = Query(None),
    asset_type_ids: Optional[List[int]] = Query(None),
    currency_id: Optional[int] = Query(None),
    service: PortfolioTransactionService = Depends(get_portfolio_transaction_read_service),
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
    service: PortfolioTransactionService = Depends(get_portfolio_transaction_write_service),
):
    await service.create_transaction(transaction.model_dump())
    run_task(recalculate_position_asset, transaction.portfolio_id, transaction.asset_id)
    return {'message': 'Transaction created'}


@router.put('/{transaction_id}')
async def update_transaction(
    transaction_id: int,
    transaction: dict,
    service: PortfolioTransactionService = Depends(get_portfolio_transaction_write_service),
):
    transaction = {**transaction, 'id': transaction_id}
    await service.update_transaction(transaction)
    return {'message': 'Transaction updated'}


@router.delete('/{transaction_id}')
async def delete_transaction(
    transaction_id: int,
    portfolio_id: int = Body(...),
    asset_id: int = Body(...),
    service: PortfolioTransactionService = Depends(get_portfolio_transaction_write_service),
):
    await service.delete_transaction(transaction_id)
    run_task(recalculate_position_asset, portfolio_id, asset_id)
    return {'message': 'Transaction deleted'}
