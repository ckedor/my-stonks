from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
    func,
)

from app.infra.db.base import Base

source_file_table = Table(
    'source_file',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('dataset', String(40), nullable=False),
    Column('period', String(10), nullable=False),
    Column('etag', String(80), nullable=True),
    Column('last_modified', DateTime(timezone=True), nullable=True),
    Column('size_bytes', BigInteger, nullable=True),
    Column('content_version', String(64), nullable=True),
    Column('applied_registry_version', String(64), nullable=True),
    Column('fetched_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint('dataset', 'period', name='uq_source_file_dataset_period'),
    schema='market_data',
)

fund_share_value_coverage_table = Table(
    'fund_share_value_coverage',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'source_file_id',
        Integer,
        ForeignKey('market_data.source_file.id', ondelete='CASCADE'),
        nullable=False,
    ),
    Column(
        'asset_id',
        Integer,
        ForeignKey('asset.asset.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    ),
    Column('content_version', String(64), nullable=False),
    Column('selection_version', Integer, nullable=False),
    Column('covered_from', Date, nullable=False),
    Column('covered_to', Date, nullable=False),
    Column('matched_rows', Integer, nullable=False, server_default='0'),
    Column('processed_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint(
        'source_file_id',
        'asset_id',
        'content_version',
        'selection_version',
        'covered_from',
        'covered_to',
        name='uq_fund_share_value_coverage_application',
    ),
    schema='market_data',
)

ingestion_checkpoint_table = Table(
    'ingestion_checkpoint',
    Base.metadata,
    Column('name', String(60), primary_key=True),
    Column('succeeded_at', DateTime(timezone=True), nullable=False),
    schema='market_data',
)
