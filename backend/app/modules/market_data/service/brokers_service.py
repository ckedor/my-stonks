# app/modules/brokers/service/brokers_service.py
"""
Brokers service - handles broker management operations.
"""

from typing import Optional

from app.core.exceptions import AlreadyExistsError, NotFoundError
from app.modules.market_data.domain.assets import Broker
from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.infra.db.unit_of_work import UnitOfWork


class BrokersService:
    def __init__(
        self,
        repository: SQLAlchemyRepository | None = None,
        uow: UnitOfWork | None = None,
    ):
        self.repository = repository
        self.uow = uow

    def _read_repository(self) -> SQLAlchemyRepository:
        if self.repository is None:
            raise RuntimeError('A repository is required for this read operation')
        return self.repository

    def _write_uow(self) -> UnitOfWork:
        if self.uow is None:
            raise RuntimeError('A UnitOfWork is required for this write operation')
        return self.uow

    async def list_brokers(self):
        brokers = await self._read_repository().get(Broker)
        return brokers

    async def get_broker(self, broker_id: int) -> Broker:
        broker = await self._read_repository().get(Broker, id=broker_id)
        if not broker:
            raise NotFoundError('Broker not found')
        return broker

    async def create_broker(self, name: str, cnpj: Optional[str], currency_id: int) -> Broker:
        async with self._write_uow() as uow:
            if cnpj:
                existing = await uow.repository.get(Broker, by={'cnpj': cnpj}, first=True)
                if existing:
                    raise AlreadyExistsError('Broker with this CNPJ already exists')

            data = {'name': name, 'cnpj': cnpj, 'currency_id': currency_id}
            await uow.repository.create(Broker, data)
            return await uow.repository.get(
                Broker,
                by={'name': name, 'cnpj': cnpj},
                first=True,
            )

    async def update_broker(
        self,
        broker_id: int,
        name: Optional[str] = None,
        cnpj: Optional[str] = None,
        currency_id: Optional[int] = None,
    ) -> Broker:
        async with self._write_uow() as uow:
            broker = await uow.repository.get(Broker, id=broker_id)
            if not broker:
                raise NotFoundError('Broker not found')

            if cnpj and cnpj != broker.cnpj:
                existing = await uow.repository.get(Broker, by={'cnpj': cnpj}, first=True)
                if existing and existing.id != broker_id:
                    raise AlreadyExistsError('Another broker with this CNPJ already exists')

            update_data = {'id': broker_id}
            if name is not None:
                update_data['name'] = name
            if cnpj is not None:
                update_data['cnpj'] = cnpj
            if currency_id is not None:
                update_data['currency_id'] = currency_id

            await uow.repository.update(Broker, update_data)
            return await uow.repository.get(Broker, id=broker_id)

    async def delete_broker(self, broker_id: int) -> None:
        async with self._write_uow() as uow:
            await uow.repository.delete(Broker, id=broker_id)
