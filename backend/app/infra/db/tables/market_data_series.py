from sqlalchemy import Column, Date, ForeignKey, Integer, Numeric, String, Table, UniqueConstraint

from app.infra.db.base import Base


market_data_series_table = Table(
    'market_data_series',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('symbol', String(10), unique=True, nullable=False),
    Column('short_name', String(50), nullable=False),
    Column('name', String(100), nullable=False),
    Column('series_type', String(30), nullable=False),
    Column('value_type', String(30), nullable=False),
    Column('frequency', String(20), nullable=False),
    Column('currency_id', Integer, ForeignKey('asset.currency.id'), nullable=True),
    schema='market_data',
)


market_data_series_history_table = Table(
    'market_data_series_history',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'series_id',
        Integer,
        ForeignKey('market_data.market_data_series.id'),
        nullable=False,
    ),
    Column('date', Date, nullable=False),
    Column('open', Numeric(18, 8), nullable=True),
    Column('close', Numeric(18, 8), nullable=True),
    Column('high', Numeric(18, 8), nullable=True),
    Column('low', Numeric(18, 8), nullable=True),
    Column('source', String(50), nullable=False, server_default='unknown'),
    UniqueConstraint('series_id', 'date', name='uq_market_data_series_history_date'),
    schema='market_data',
)
