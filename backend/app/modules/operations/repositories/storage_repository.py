from sqlalchemy import text

from app.infra.db.repositories.base_repository import SQLAlchemyRepository
from app.modules.operations.domain.storage import DatabaseStorage, TableStorage

_TABLES = text(
    """
    SELECT schemaname AS schema,
           relname AS name,
           n_live_tup AS rows,
           pg_table_size(relid) AS table_bytes,
           pg_indexes_size(relid) AS index_bytes
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC, schemaname, relname
    """
)


class StorageRepository(SQLAlchemyRepository):
    async def database_storage(self) -> DatabaseStorage:
        size = await self.session.execute(text('SELECT pg_database_size(current_database())'))
        result = await self.session.execute(_TABLES)
        return DatabaseStorage(
            database_bytes=size.scalar_one(),
            tables=[
                TableStorage(
                    schema=row.schema,
                    name=row.name,
                    rows=row.rows,
                    table_bytes=row.table_bytes,
                    index_bytes=row.index_bytes,
                )
                for row in result
            ],
        )
