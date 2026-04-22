# app/modules/brokers/service/brokers_service.py
"""
Brokers service - handles broker management operations.
"""

from typing import Optional

from app.core.exceptions import AlreadyExistsError, NotFoundError
from app.infra.db.models.portfolio import Broker
from app.infra.db.repositories.base_repository import SQLAlchemyRepository


class BrokersService:
    def __init__(self, session):
        self.session = session
        self.repo = SQLAlchemyRepository(session)

    async def list_brokers(self):
        brokers = await self.repo.get(Broker)
        return brokers

    async def get_broker(self, broker_id: int) -> Broker:
        broker = await self.repo.get(Broker, id=broker_id)
        if not broker:
            raise NotFoundError('Broker not found')
        return broker

    async def create_broker(self, name: str, cnpj: Optional[str], currency_id: int) -> Broker:
        # Verificar se já existe broker com o mesmo CNPJ
        if cnpj:
            existing = await self.repo.get(Broker, by={'cnpj': cnpj}, first=True)
            if existing:
                raise AlreadyExistsError('Broker with this CNPJ already exists')
        
        data = {
            'name': name,
            'cnpj': cnpj,
            'currency_id': currency_id
        }
        await self.repo.create(Broker, data)
        await self.session.commit()
        
        # Buscar o broker criado para retornar com as relations
        broker = await self.repo.get(Broker, by={'name': name, 'cnpj': cnpj}, first=True)
        return broker

    async def update_broker(
        self, 
        broker_id: int, 
        name: Optional[str] = None,
        cnpj: Optional[str] = None,
        currency_id: Optional[int] = None
    ) -> Broker:
        broker = await self.get_broker(broker_id)
        
        # Verificar se o CNPJ já existe em outro broker
        if cnpj and cnpj != broker.cnpj:
            existing = await self.repo.get(Broker, by={'cnpj': cnpj}, first=True)
            if existing and existing.id != broker_id:
                raise AlreadyExistsError('Another broker with this CNPJ already exists')
        
        # Preparar dados para atualização
        update_data = {'id': broker_id}
        if name is not None:
            update_data['name'] = name
        if cnpj is not None:
            update_data['cnpj'] = cnpj
        if currency_id is not None:
            update_data['currency_id'] = currency_id
        
        await self.repo.update(Broker, update_data)
        await self.session.commit()
        
        # Buscar broker atualizado
        broker = await self.repo.get(Broker, id=broker_id)
        return broker

    async def delete_broker(self, broker_id: int) -> None:
        await self.repo.delete(Broker, id=broker_id)
        await self.session.commit()
