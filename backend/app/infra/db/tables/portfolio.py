from sqlalchemy import JSON, Boolean, Column, Date, DateTime, Float, ForeignKey
from sqlalchemy import Integer, String, Table, UniqueConstraint

from app.infra.db.base import Base

portfolio_table = Table(
    'portfolio',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(100), nullable=False),
    Column('user_id', Integer, ForeignKey('user.id'), nullable=False),
    schema='portfolio',
)

position_table = Table(
    'position',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('portfolio_id', Integer, ForeignKey('portfolio.portfolio.id'), nullable=False),
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), nullable=False),
    Column('date', Date, nullable=False),
    Column('quantity', Float, nullable=False),
    Column('price', Float, nullable=False),
    Column('average_price', Float, nullable=False),
    Column('daily_return', Float, nullable=False),
    Column('acc_return', Float, nullable=False),
    Column('twelve_months_return', Float),
    Column('cagr', Float),
    Column('price_usd', Float, nullable=False),
    Column('average_price_usd', Float, nullable=False),
    Column('daily_return_usd', Float, nullable=False),
    Column('acc_return_usd', Float, nullable=False),
    Column('twelve_months_return_usd', Float),
    Column('cagr_usd', Float),
    Column('total_invested', Float),
    Column('total_invested_usd', Float),
    UniqueConstraint(
        'portfolio_id',
        'asset_id',
        'date',
        name='uq_position_by_portfolio_asset_date',
    ),
    schema='portfolio',
)

transaction_table = Table(
    'transaction',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('portfolio_id', Integer, ForeignKey('portfolio.portfolio.id'), nullable=False),
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), nullable=False),
    Column('broker_id', Integer, ForeignKey('portfolio.broker.id'), nullable=False),
    Column('date', DateTime, nullable=False),
    Column('quantity', Float, nullable=False),
    Column('price', Float, nullable=False),
    Column('price_usd', Float, nullable=True),
    schema='portfolio',
)

dividend_table = Table(
    'dividend',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('portfolio_id', Integer, ForeignKey('portfolio.portfolio.id'), nullable=False),
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), nullable=False),
    Column('date', Date, nullable=False),
    Column('amount', Float, nullable=False),
    Column('amount_usd', Float, nullable=True),
    schema='portfolio',
)

return_12m_table = Table(
    'return_12m',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('portfolio_id', Integer, ForeignKey('portfolio.portfolio.id'), nullable=False),
    Column('date', Date, nullable=False),
    Column('return_pct', Float, nullable=False),
    schema='portfolio',
)

custom_category_table = Table(
    'custom_category',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(100), nullable=False),
    Column('portfolio_id', Integer, ForeignKey('portfolio.portfolio.id'), nullable=False),
    Column('color', String(7), nullable=False, default='#000'),
    Column('benchmark_id', Integer, ForeignKey('market_data.market_data_series.id')),
    Column('target_percentage', Float, nullable=True),
    schema='portfolio',
)

custom_category_assignment_table = Table(
    'custom_category_assignment',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'custom_category_id',
        Integer,
        ForeignKey('portfolio.custom_category.id'),
        nullable=False,
    ),
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), nullable=False),
    Column('target_percentage', Float, nullable=True),
    schema='portfolio',
)

configuration_name_table = Table(
    'configuration_name',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(64), nullable=False, unique=True),
    schema='portfolio',
)

portfolio_user_configuration_table = Table(
    'user_configuration',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'portfolio_id',
        Integer,
        ForeignKey('portfolio.portfolio.id', ondelete='CASCADE'),
        nullable=False,
    ),
    Column(
        'configuration_name_id',
        Integer,
        ForeignKey('portfolio.configuration_name.id'),
        nullable=False,
    ),
    Column('enabled', Boolean, default=False, nullable=False),
    Column('config_data', JSON, nullable=True),
    schema='portfolio',
)

portfolio_return_table = Table(
    'portfolio_return',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('portfolio_id', Integer, ForeignKey('portfolio.portfolio.id'), nullable=False),
    Column('date', Date, nullable=False),
    Column('daily_return', Float, nullable=False),
    Column('acc_return', Float, nullable=False),
    Column('cagr', Float, nullable=True),
    Column('daily_return_usd', Float, nullable=True),
    Column('acc_return_usd', Float, nullable=True),
    Column('cagr_usd', Float, nullable=True),
    UniqueConstraint(
        'portfolio_id',
        'date',
        name='uq_portfolio_return_portfolio_date',
    ),
    schema='portfolio',
)

category_return_table = Table(
    'category_return',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('portfolio_id', Integer, ForeignKey('portfolio.portfolio.id'), nullable=False),
    Column(
        'custom_category_id',
        Integer,
        ForeignKey('portfolio.custom_category.id'),
        nullable=False,
    ),
    Column('date', Date, nullable=False),
    Column('daily_return', Float, nullable=False),
    Column('acc_return', Float, nullable=False),
    Column('cagr', Float, nullable=True),
    Column('daily_return_usd', Float, nullable=True),
    Column('acc_return_usd', Float, nullable=True),
    Column('cagr_usd', Float, nullable=True),
    UniqueConstraint(
        'portfolio_id',
        'custom_category_id',
        'date',
        name='uq_category_return_portfolio_category_date',
    ),
    schema='portfolio',
)
