"""Broker CRUD routes."""

from typing import List

from app.infra.db.session import get_session
from app.modules.market_data.api.broker.schemas import (
    Broker,
    BrokerCreate,
    BrokerUpdate,
)
from app.modules.market_data.service.brokers_service import BrokersService
from fastapi import APIRouter, Depends, status

router = APIRouter(prefix='/broker', tags=['Broker'])


@router.get('', response_model=List[Broker])
async def list_brokers(
    session=Depends(get_session),
):
    """List all brokers"""
    service = BrokersService(session)
    return await service.list_brokers()


@router.get('/{broker_id}', response_model=Broker)
async def get_broker(
    broker_id: int,
    session=Depends(get_session),
):
    """Get a specific broker by ID"""
    service = BrokersService(session)
    return await service.get_broker(broker_id)


@router.post('', response_model=Broker, status_code=status.HTTP_201_CREATED)
async def create_broker(
    broker_data: BrokerCreate,
    session=Depends(get_session),
):
    """Create a new broker"""
    service = BrokersService(session)
    return await service.create_broker(
        name=broker_data.name,
        cnpj=broker_data.cnpj,
        currency_id=broker_data.currency_id,
    )


@router.put('/{broker_id}', response_model=Broker)
async def update_broker(
    broker_id: int,
    broker_data: BrokerUpdate,
    session=Depends(get_session),
):
    """Update an existing broker"""
    service = BrokersService(session)
    return await service.update_broker(
        broker_id=broker_id,
        name=broker_data.name,
        cnpj=broker_data.cnpj,
        currency_id=broker_data.currency_id,
    )


@router.delete('/{broker_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_broker(
    broker_id: int,
    session=Depends(get_session),
):
    """Delete a broker"""
    service = BrokersService(session)
    await service.delete_broker(broker_id)
    return None
