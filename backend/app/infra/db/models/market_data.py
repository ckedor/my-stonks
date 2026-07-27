from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.infra.db.base import Base


class Index(Base):
    __tablename__ = 'index'
    __table_args__ = {'schema': 'market_data'}

    id = Column(Integer, primary_key=True)
    symbol = Column(String(10), unique=True, nullable=False)

    short_name = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)

    currency_id = Column(Integer, ForeignKey('asset.currency.id'), nullable=True)

    currency = relationship('Currency', lazy='joined')

    def __repr__(self):
        return f'{self.symbol}'


class IndexHistory(Base):
    __tablename__ = 'index_history'
    __table_args__ = (
        UniqueConstraint('index_id', 'date', name='uq_index_date'),
        {'schema': 'market_data'},
    )

    COLUMNS = ['index_id', 'date', 'open', 'close', 'high', 'low']

    id = Column(Integer, primary_key=True)
    index_id = Column(Integer, ForeignKey('market_data.index.id'), nullable=False)
    date = Column(Date, nullable=False)

    open = Column(Numeric(18, 8), nullable=True)
    close = Column(Numeric(18, 8), nullable=True)
    high = Column(Numeric(18, 8), nullable=True)
    low = Column(Numeric(18, 8), nullable=True)

    index = relationship('Index', lazy='joined')

    def __repr__(self):
        return f'{self.series.symbol} - {self.date}'


class AssetPriceHistory(Base):
    __tablename__ = 'asset_price_history'
    __table_args__ = (
        UniqueConstraint('asset_id', 'date', name='uq_asset_date'),
        {'schema': 'market_data'},
    )

    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey('asset.asset.id'), nullable=False)
    currency_id = Column(Integer, ForeignKey('asset.currency.id'), nullable=True)
    date = Column(Date, nullable=False)
    open = Column(Numeric(18, 8), nullable=True)
    close = Column(Numeric(18, 8), nullable=True)
    adjusted_close = Column(Numeric(18, 8), nullable=True)
    high = Column(Numeric(18, 8), nullable=True)
    low = Column(Numeric(18, 8), nullable=True)
    volume = Column(Numeric(24, 8), nullable=True)
    source = Column(String(50), nullable=False, server_default='unknown')
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    asset = relationship('Asset', lazy='joined')
    currency = relationship('Currency', lazy='joined')

    COLUMNS = [
        'asset_id',
        'currency_id',
        'date',
        'open',
        'close',
        'adjusted_close',
        'high',
        'low',
        'volume',
        'source',
    ]

    def __repr__(self):
        return f'{self.asset.ticker} - {self.date}'
