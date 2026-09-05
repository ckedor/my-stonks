from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)

from app.infra.db.base import Base

research_source_table = Table(
    'research_source',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(120), nullable=False),
    Column('slug', String(120), nullable=False, unique=True),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    schema='research',
)

recommended_portfolio_type_table = Table(
    'recommended_portfolio_type',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('name', String(120), nullable=False),
    Column('slug', String(120), nullable=False, unique=True),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    schema='research',
)

recommended_portfolio_table = Table(
    'recommended_portfolio',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'source_id',
        Integer,
        ForeignKey('research.research_source.id', ondelete='RESTRICT'),
        nullable=False,
    ),
    # Nullable: the editions imported before the list of types existed have
    # none, and a type erased from the cadastro must not take the edition with
    # it.
    Column(
        'type_id',
        Integer,
        ForeignKey('research.recommended_portfolio_type.id', ondelete='SET NULL'),
    ),
    Column('title', String(200), nullable=False),
    Column('reference_date', Date, nullable=False),
    Column('summary', Text),
    Column('objective', Text),
    Column('created_at', DateTime(timezone=True), nullable=False, server_default=func.now()),
    UniqueConstraint(
        'source_id',
        'title',
        'reference_date',
        name='uq_recommended_portfolio_edition',
    ),
    Index('ix_recommended_portfolio_reference_date', 'reference_date'),
    schema='research',
)

recommended_position_table = Table(
    'recommended_position',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column(
        'recommended_portfolio_id',
        Integer,
        ForeignKey('research.recommended_portfolio.id', ondelete='CASCADE'),
        nullable=False,
    ),
    # An asset the catalogue does not carry yet still belongs to the
    # recommendation, and de-registering one must not take the line with it:
    # the ticker and the weight are what the report said either way.
    Column('asset_id', Integer, ForeignKey('asset.asset.id', ondelete='SET NULL')),
    Column('ticker', String(30), nullable=False),
    Column('name', String(200)),
    Column('weight', Float, nullable=False),
    Column('rationale', Text),
    Column('target_price', Float),
    Column('change', String(20)),
    UniqueConstraint(
        'recommended_portfolio_id',
        'ticker',
        name='uq_recommended_position_ticker',
    ),
    schema='research',
)
