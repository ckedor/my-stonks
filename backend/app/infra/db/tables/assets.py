from sqlalchemy import (
    Column,
    Date,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    UniqueConstraint,
)

from app.infra.db.base import Base

exchange_table = Table(
    'exchange',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('code', String(10), unique=True, nullable=False),
    Column('name', String(100), nullable=False),
    schema='asset',
)

asset_class_table = Table(
    'asset_class',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(50), nullable=False, unique=True),
    schema='asset',
)

asset_type_table = Table(
    'asset_type',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('short_name', String(20), nullable=False, unique=True),
    Column('name', String(100), nullable=False),
    Column('asset_class_id', Integer, ForeignKey('asset.asset_class.id'), nullable=False),
    schema='asset',
)

currency_table = Table(
    'currency',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('code', String(3), unique=True, nullable=False),
    Column('name', String(50), nullable=False),
    schema='asset',
)

asset_table = Table(
    'asset',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('ticker', String(30), nullable=True),
    Column('name', String(200), nullable=False),
    Column('asset_type_id', Integer, ForeignKey('asset.asset_type.id'), nullable=False),
    Column('exchange_id', Integer, ForeignKey('asset.exchange.id'), nullable=True),
    # A URL do logo, e não a imagem: quem serve o arquivo é o provedor, e o
    # navegador já sabe guardá-lo.
    Column('logo_url', String(500), nullable=True),
    UniqueConstraint(
        'ticker',
        'exchange_id',
        'asset_type_id',
        name='uq_asset_ticker_exchange_type',
    ),
    schema='asset',
)

event_table = Table(
    'event',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), nullable=False),
    Column('date', Date, nullable=False),
    Column('type', String(50), nullable=False),
    Column('factor', Float, nullable=False),
    schema='asset',
)

stock_table = Table(
    'stock',
    Base.metadata,
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), primary_key=True),
    Column('country', String(50), nullable=True),
    Column('sector', String(100), nullable=True),
    Column('industry', String(100), nullable=True),
    schema='asset',
)

etf_segment_table = Table(
    'etf_segment',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(50), nullable=False, unique=True),
    schema='asset',
)

etf_table = Table(
    'etf',
    Base.metadata,
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), primary_key=True),
    Column('segment_id', Integer, ForeignKey('asset.etf_segment.id')),
    schema='asset',
)

fii_type_table = Table(
    'fii_type',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(50), nullable=False, unique=True),
    schema='asset',
)

fii_segment_table = Table(
    'fii_segment',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(50), nullable=False, unique=True),
    Column('type_id', Integer, ForeignKey('asset.fii_type.id')),
    schema='asset',
)

fii_table = Table(
    'fii',
    Base.metadata,
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), primary_key=True),
    Column('segment_id', Integer, ForeignKey('asset.fii_segment.id'), nullable=False),
    schema='asset',
)

fixed_income_type_table = Table(
    'fixed_income_type',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(50), nullable=False),
    Column('description', String(255)),
    schema='asset',
)

fixed_income_table = Table(
    'fixed_income',
    Base.metadata,
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), primary_key=True),
    Column('maturity_date', Date),
    Column('fee', Numeric(8, 5)),
    Column('index_id', Integer, ForeignKey('market_data.market_data_series.id')),
    Column('fixed_income_type_id', Integer, ForeignKey('asset.fixed_income_type.id')),
    schema='asset',
)

investment_fund_table = Table(
    'fund',
    Base.metadata,
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), primary_key=True),
    Column('legal_id', String(20)),
    Column('anbima_code', String(12)),
    Column('anbima_code_class', String(12)),
    Column('anbima_category', String(100)),
    schema='asset',
)

treasury_bond_type_table = Table(
    'treasury_bond_type',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('code', String(20), nullable=False, unique=True),
    Column('name', String(100), nullable=False, unique=True),
    Column('description', String(255), nullable=True),
    schema='asset',
)

treasury_bond_table = Table(
    'treasury_bond',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('asset_id', Integer, ForeignKey('asset.asset.id'), nullable=False),
    Column('maturity_date', Date),
    Column('fee', Numeric(8, 5), nullable=True),
    Column('type_id', Integer, ForeignKey('asset.treasury_bond_type.id'), nullable=False),
    schema='asset',
)

broker_table = Table(
    'broker',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(100), nullable=False),
    Column('cnpj', String(18), unique=True, nullable=True),
    Column('currency_id', Integer, ForeignKey('asset.currency.id'), nullable=False),
    schema='portfolio',
)
