from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Table,
    UniqueConstraint,
    func,
)

from app.infra.db.base import Base

asset_visit_table = Table(
    'asset_visit',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('user_id', Integer, ForeignKey('public.user.id', ondelete='CASCADE'), nullable=False),
    Column('asset_id', Integer, ForeignKey('asset.asset.id', ondelete='CASCADE'), nullable=False),
    Column('visit_count', Integer, nullable=False, server_default='0'),
    Column(
        'last_visited_at',
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    ),
    UniqueConstraint('user_id', 'asset_id', name='uq_asset_visit_user_asset'),
    schema='market_data',
)
