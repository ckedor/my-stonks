# app/modules/brokers/service/brokers_service.py
"""
Brokers service - handles broker management operations.
"""

from app.core.exceptions import AlreadyExistsError, NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.domain.assets import Broker


class BrokersService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    async def list_brokers(self):
        async with self.uow as uow:
            return await uow.repository.get(Broker)

    async def get_broker(self, broker_id: int) -> Broker:
        async with self.uow as uow:
            broker = await uow.repository.get(Broker, id=broker_id)
            if not broker:
                raise NotFoundError('Broker not found')
            return broker

    async def create_broker(self, name: str, cnpj: str | None, currency_id: int) -> Broker:
        async with self.uow as uow:
            if cnpj:
                existing = await uow.repository.get(Broker, by={'cnpj': cnpj}, first=True)
                if existing:
                    raise AlreadyExistsError('Broker with this CNPJ already exists')

            data = {'name': name, 'cnpj': cnpj, 'currency_id': currency_id}
            await uow.repository.create(Broker, data)
            broker = await uow.repository.get(
                Broker,
                by={'name': name, 'cnpj': cnpj},
                first=True,
            )
            await uow.commit()
            return broker

    async def update_broker(
        self,
        broker_id: int,
        name: str | None = None,
        cnpj: str | None = None,
        currency_id: int | None = None,
    ) -> Broker:
        async with self.uow as uow:
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
            updated = await uow.repository.get(Broker, id=broker_id)
            await uow.commit()
            return updated

    async def delete_broker(self, broker_id: int) -> None:
        async with self.uow as uow:
            await uow.repository.delete(Broker, id=broker_id)
            await uow.commit()
