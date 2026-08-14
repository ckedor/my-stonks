"""Broker CRUD routes."""

from fastapi import APIRouter, Depends, status

from app.composition.market_data import get_broker_service
from app.modules.market_data.api.broker.schemas import (
    Broker,
    BrokerCreate,
    BrokerUpdate,
)
from app.modules.market_data.service.brokers_service import BrokersService

router = APIRouter(prefix='/broker', tags=['Broker'])


@router.get('', response_model=list[Broker])
async def list_brokers(
    service: BrokersService = Depends(get_broker_service),
):
    """List all brokers"""
    return await service.list_brokers()


@router.get('/{broker_id}', response_model=Broker)
async def get_broker(
    broker_id: int,
    service: BrokersService = Depends(get_broker_service),
):
    """Get a specific broker by ID"""
    return await service.get_broker(broker_id)


@router.post('', response_model=Broker, status_code=status.HTTP_201_CREATED)
async def create_broker(
    broker_data: BrokerCreate,
    service: BrokersService = Depends(get_broker_service),
):
    """Create a new broker"""
    return await service.create_broker(
        name=broker_data.name,
        cnpj=broker_data.cnpj,
        currency_id=broker_data.currency_id,
    )


@router.put('/{broker_id}', response_model=Broker)
async def update_broker(
    broker_id: int,
    broker_data: BrokerUpdate,
    service: BrokersService = Depends(get_broker_service),
):
    """Update an existing broker"""
    return await service.update_broker(
        broker_id=broker_id,
        name=broker_data.name,
        cnpj=broker_data.cnpj,
        currency_id=broker_data.currency_id,
    )


@router.delete('/{broker_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_broker(
    broker_id: int,
    service: BrokersService = Depends(get_broker_service),
):
    """Delete a broker"""
    await service.delete_broker(broker_id)
