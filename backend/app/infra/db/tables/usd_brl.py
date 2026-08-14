from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Integer,
    Numeric,
    String,
    Table,
    UniqueConstraint,
    func,
)

from app.infra.db.base import Base

usd_brl_history_table = Table(
    'usd_brl_history',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('date', Date, nullable=False),
    # Both directions are stored so no consumer has to invert the rate.
    Column('usd_brl', Numeric(18, 8), nullable=False),
    # ``brl_usd`` sits around 0.19, so it needs more decimal places than
    # ``usd_brl`` to carry the same relative precision.
    Column('brl_usd', Numeric(20, 12), nullable=False),
    Column('source', String(50), nullable=False),
    Column(
        'updated_at',
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    ),
    UniqueConstraint('date', name='uq_usd_brl_history_date'),
    schema='market_data',
)
