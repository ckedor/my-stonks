from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    UniqueConstraint,
    func,
)

from app.infra.db.base import Base

quote_table = Table(
    'quote',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), nullable=False),
    Column('currency_id', Integer, ForeignKey('asset.currency.id'), nullable=True),
    Column('date', Date, nullable=False),
    Column('open', Numeric(18, 8), nullable=True),
    Column('close', Numeric(18, 8), nullable=True),
    Column('adjusted_close', Numeric(18, 8), nullable=True),
    Column('high', Numeric(18, 8), nullable=True),
    Column('low', Numeric(18, 8), nullable=True),
    Column('volume', Numeric(24, 8), nullable=True),
    Column('source', String(50), nullable=False, server_default='unknown'),
    Column(
        'updated_at',
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    ),
    UniqueConstraint('asset_id', 'date', name='uq_quote_asset_date'),
    schema='market_data',
)
