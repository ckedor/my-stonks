from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    func,
)

from app.infra.db.base import Base


data_ingestion_execution_table = Table(
    'data_ingestion_execution',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('ingestion_type', String(30), nullable=False, index=True),
    Column('task_id', String(100), nullable=True),
    Column('trigger', String(20), nullable=False),
    Column('status', String(30), nullable=False),
    Column('force_full_history', Boolean, nullable=False, default=False),
    Column('parameters', JSON, nullable=False, default=dict),
    Column('requested_by_user_id', Integer, ForeignKey('user.id'), nullable=True),
    Column('requested_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column('started_at', DateTime(timezone=True), nullable=True),
    Column('finished_at', DateTime(timezone=True), nullable=True),
    Column('total_items', Integer, nullable=False, default=0),
    Column('processed_items', Integer, nullable=False, default=0),
    Column('succeeded_items', Integer, nullable=False, default=0),
    Column('failed_items', Integer, nullable=False, default=0),
    Column('fetched_rows', Integer, nullable=False, default=0),
    Column('upserted_rows', Integer, nullable=False, default=0),
    Column('error', Text, nullable=True),
    Index('ix_market_data_quote_ingestion_execution_status', 'status'),
    Index('ix_market_data_quote_ingestion_execution_task_id', 'task_id'),
    schema='market_data',
)


data_ingestion_attempt_table = Table(
    'data_ingestion_attempt',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'execution_id',
        Integer,
        ForeignKey('market_data.data_ingestion_execution.id', ondelete='CASCADE'),
        nullable=False,
    ),
    Column('item_id', Integer, nullable=True),
    Column('item_label', String(100), nullable=False),
    Column('source', String(50), nullable=False),
    Column('status', String(30), nullable=False),
    Column('parameters', JSON, nullable=False, default=dict),
    Column('attempted_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    Column('finished_at', DateTime(timezone=True), nullable=True),
    Column('fetched_rows', Integer, nullable=False, default=0),
    Column('upserted_rows', Integer, nullable=False, default=0),
    Column('error', Text, nullable=True),
    Index('ix_market_data_quote_ingestion_attempt_execution_id', 'execution_id'),
    Index('ix_market_data_quote_ingestion_attempt_status', 'status'),
    schema='market_data',
)
