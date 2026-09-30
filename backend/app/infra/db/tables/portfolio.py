from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)

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

brokerage_note_table = Table(
    'brokerage_note',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('portfolio_id', Integer, ForeignKey('portfolio.portfolio.id'), nullable=False),
    Column('broker_id', Integer, ForeignKey('portfolio.broker.id'), nullable=False),
    Column('currency', String(3), nullable=False, server_default='BRL'),
    Column('note_number', String(40), nullable=True),
    Column('trade_date', Date, nullable=False),
    Column('settlement_date', Date, nullable=True),
    Column('purchases_total', Float, nullable=True),
    Column('sales_total', Float, nullable=True),
    Column('operations_total', Float, nullable=True),
    Column('settlement_fee', Float, nullable=True),
    Column('registration_fee', Float, nullable=True),
    Column('emoluments', Float, nullable=True),
    Column('other_exchange_fees', Float, nullable=True),
    Column('brokerage', Float, nullable=True),
    Column('iss', Float, nullable=True),
    Column('other_costs', Float, nullable=True),
    Column('withheld_income_tax', Float, nullable=True),
    Column('net_amount', Float, nullable=True),
    Column('imported_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint(
        'portfolio_id', 'broker_id', 'note_number', name='uq_brokerage_note_by_broker_number'
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
    Column('settlement_date', Date, nullable=True),
    Column('fees', Float, nullable=True),
    Column('withheld_income_tax', Float, nullable=True),
    Column(
        'brokerage_note_id',
        Integer,
        ForeignKey('portfolio.brokerage_note.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    ),
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
    Column('kind', String(20), nullable=False, server_default='dividend'),
    CheckConstraint("kind IN ('dividend', 'interest_on_equity')", name='ck_dividend_kind'),
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

return_series_table = Table(
    'return_series',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('portfolio_id', Integer, ForeignKey('portfolio.portfolio.id'), nullable=False),
    # scope_key is text and not a foreign key on purpose: it holds a category
    # id, an asset-type id or a segment code depending on the scope, and no
    # column can reference three tables. See domain/return_scope.py.
    Column('scope', String, nullable=False),
    Column('scope_key', String, nullable=False),
    Column('date', Date, nullable=False),
    Column('daily_return', Float, nullable=False),
    Column('acc_return', Float, nullable=False),
    Column('cagr', Float, nullable=True),
    Column('daily_return_usd', Float, nullable=True),
    Column('acc_return_usd', Float, nullable=True),
    Column('cagr_usd', Float, nullable=True),
    UniqueConstraint(
        'portfolio_id',
        'scope',
        'scope_key',
        'date',
        name='uq_return_series_portfolio_scope_date',
    ),
    Index('ix_return_series_lookup', 'portfolio_id', 'scope', 'scope_key', 'date'),
    schema='portfolio',
)

portfolio_consolidation_table = Table(
    'portfolio_consolidation',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'portfolio_id',
        Integer,
        ForeignKey('portfolio.portfolio.id'),
        nullable=False,
        unique=True,
    ),
    Column('consolidated_at', DateTime(timezone=True), nullable=False),
    Column('status', String, nullable=False),
    Column('error', Text, nullable=True),
    schema='portfolio',
)

#: Um DARF pago, como a pessoa o registrou. É do usuário, e não de uma carteira,
#: porque a apuração é do contribuinte: o DARF de um mês junta todas elas.
darf_payment_table = Table(
    'darf_payment',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False),
    Column('revenue_code', String(4), nullable=False),
    # O mês de apuração, guardado no primeiro dia.
    Column('period', Date, nullable=False),
    Column('paid_on', Date, nullable=False),
    Column('principal', Numeric(14, 2), nullable=False),
    Column('fine', Numeric(14, 2), nullable=False, server_default='0'),
    Column('interest', Numeric(14, 2), nullable=False, server_default='0'),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    CheckConstraint('extract(day from period) = 1', name='ck_darf_payment_period_first_day'),
    CheckConstraint('principal > 0', name='ck_darf_payment_principal_positive'),
    CheckConstraint('fine >= 0 AND interest >= 0', name='ck_darf_payment_charges_not_negative'),
    Index('ix_darf_payment_user_period', 'user_id', 'period'),
    schema='portfolio',
)
