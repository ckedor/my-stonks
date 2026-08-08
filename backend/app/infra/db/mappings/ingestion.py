from sqlalchemy import inspect
from sqlalchemy.orm import relationship

from app.infra.db.base import Base
from app.infra.db.tables.ingestion import (
    data_ingestion_attempt_table,
    data_ingestion_execution_table,
)
from app.modules.market_data.domain.ingestion import (
    DataIngestionAttempt,
    DataIngestionExecution,
)


def map_data_ingestion() -> None:
    if inspect(DataIngestionExecution, raiseerr=False) is not None:
        return
    Base.registry.map_imperatively(
        DataIngestionExecution,
        data_ingestion_execution_table,
        properties={
            'attempts': relationship(
                DataIngestionAttempt,
                back_populates='execution',
                cascade='all, delete-orphan',
                order_by=data_ingestion_attempt_table.c.id,
            )
        },
    )
    Base.registry.map_imperatively(
        DataIngestionAttempt,
        data_ingestion_attempt_table,
        properties={'execution': relationship(DataIngestionExecution, back_populates='attempts')},
    )
