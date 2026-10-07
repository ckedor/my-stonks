"""The database's storage, table by table."""

from app.infra.db.unit_of_work import UnitOfWork
from app.modules.operations.domain.storage import DatabaseStorage


class StorageReadService:
    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

    async def database_storage(self) -> DatabaseStorage:
        async with self.uow as uow:
            return await uow.storage.database_storage()
