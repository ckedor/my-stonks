import enum
from datetime import datetime

from app.infra.db.base import Base
from sqlalchemy import JSON, Boolean, Column, Date, DateTime
from sqlalchemy import Enum as SqlEnum
from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship


class Broker(Base):
    __tablename__ = 'broker'
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    cnpj = Column(String(18), unique=True, nullable=True)
    currency_id = Column(Integer, ForeignKey('asset.currency.id'), nullable=False)
    
    currency = relationship("Currency", lazy='joined')

    def __repr__(self):
        return self.name


class Portfolio(Base):
    __tablename__ = 'portfolio'
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    user_id = Column(Integer, ForeignKey('public.user.id'), nullable=False)

    positions = relationship('Position', back_populates='portfolio')
    transactions = relationship('Transaction', back_populates='portfolio')
    dividends = relationship('Dividend', back_populates='portfolio')
    returns = relationship('Return12M', back_populates='portfolio')
    custom_categories = relationship('CustomCategory', back_populates='portfolio')

    user = relationship('User')

    def __repr__(self):
        return self.name


class Position(Base):
    __tablename__ = 'position'
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolio.portfolio.id'), nullable=False)
    asset_id = Column(Integer, ForeignKey('asset.asset.id'), nullable=False)
    date = Column(Date, nullable=False)

    quantity = Column(Float, nullable=False)

    # Valores em BRL
    price = Column(Float, nullable=False)
    average_price = Column(Float, nullable=False)
    daily_return = Column(Float, nullable=False)
    acc_return = Column(Float, nullable=False)
    twelve_months_return = Column(Float)
    cagr = Column(Float)

    # Valores em USD
    price_usd = Column(Float, nullable=False)
    average_price_usd = Column(Float, nullable=False)
    daily_return_usd = Column(Float, nullable=False)
    acc_return_usd = Column(Float, nullable=False)
    twelve_months_return_usd = Column(Float)
    cagr_usd = Column(Float)

    total_invested = Column(Float)
    total_invested_usd = Column(Float)

    portfolio = relationship('Portfolio', back_populates='positions')
    asset = relationship('Asset')

    COLUMNS = [
        'date',
        'portfolio_id',
        'asset_id',
        'quantity',
        'price',
        'average_price',
        'daily_return',
        'acc_return',
        'twelve_months_return',
        'cagr',
        'price_usd',
        'average_price_usd',
        'daily_return_usd',
        'acc_return_usd',
        'twelve_months_return_usd',
        'cagr_usd',
        'total_invested',
        'total_invested_usd',
    ]

    def __repr__(self):
        return f'{self.date} - {self.asset.ticker} - {self.quantity} @ {self.average_price}'


class Transaction(Base):
    __tablename__ = 'transaction'
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolio.portfolio.id'), nullable=False)
    asset_id = Column(Integer, ForeignKey('asset.asset.id'), nullable=False)
    broker_id = Column(Integer, ForeignKey('portfolio.broker.id'), nullable=False)
    date = Column(DateTime, nullable=False)
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=False)        # always in BRL
    price_usd = Column(Float, nullable=True)     # always in USD

    portfolio = relationship('Portfolio', back_populates='transactions')
    asset = relationship('Asset')
    broker = relationship('Broker')


class Dividend(Base):
    __tablename__ = 'dividend'
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolio.portfolio.id'), nullable=False)
    asset_id = Column(Integer, ForeignKey('asset.asset.id'), nullable=False)
    date = Column(Date, nullable=False)
    amount = Column(Float, nullable=False)
    amount_usd = Column(Float, nullable=True)

    portfolio = relationship('Portfolio', back_populates='dividends')
    asset = relationship('Asset')

    def __repr__(self):
        return f'{self.date} - {self.asset.ticker} - R${self.amount:.2f}'


class Return12M(Base):
    __tablename__ = 'return_12m'
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolio.portfolio.id'), nullable=False)
    date = Column(Date, nullable=False)
    return_pct = Column(Float, nullable=False)

    portfolio = relationship('Portfolio', back_populates='returns')

    def __repr__(self):
        return f'{self.date} - {self.return_pct:.2%}'


class CustomCategory(Base):
    __tablename__ = 'custom_category'
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    portfolio_id = Column(Integer, ForeignKey('portfolio.portfolio.id'), nullable=False)
    color = Column(String(7), nullable=False, default='#000')
    benchmark_id = Column(Integer, ForeignKey('market_data.index.id'), nullable=True)
    target_percentage = Column(Float, nullable=True)

    portfolio = relationship('Portfolio', back_populates='custom_categories', lazy='joined')
    assignments = relationship('CustomCategoryAssignment', back_populates='category')
    benchmark = relationship('Index', lazy='joined')

    def __repr__(self):
        return f'{self.portfolio.name} - {self.name}'


class CustomCategoryAssignment(Base):
    __tablename__ = 'custom_category_assignment'
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    custom_category_id = Column(Integer, ForeignKey('portfolio.custom_category.id'), nullable=False)
    asset_id = Column(Integer, ForeignKey('asset.asset.id'), nullable=False)
    target_percentage = Column(Float, nullable=True)

    category = relationship('CustomCategory', back_populates='assignments', lazy='joined')
    asset = relationship('Asset')

    def __repr__(self):
        return f'{self.category.name} -> {self.asset.ticker}'
    
class PortfolioUserConfiguration(Base):
    __tablename__ = "user_configuration"
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey("portfolio.portfolio.id", ondelete="CASCADE"), nullable=False)
    configuration_name_id = Column(Integer, ForeignKey("portfolio.configuration_name.id"), nullable=False)

    enabled = Column(Boolean, default=False, nullable=False)
    config_data = Column(JSON, nullable=True)

    configuration_name = relationship("ConfigurationName", lazy="joined")


class PortfolioReturn(Base):
    __tablename__ = 'portfolio_return'
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolio.portfolio.id'), nullable=False)
    date = Column(Date, nullable=False)
    daily_return = Column(Float, nullable=False)
    acc_return = Column(Float, nullable=False)
    cagr = Column(Float, nullable=True)

    daily_return_usd = Column(Float, nullable=True)
    acc_return_usd = Column(Float, nullable=True)
    cagr_usd = Column(Float, nullable=True)

    portfolio = relationship('Portfolio')

    COLUMNS = [
        'portfolio_id', 'date',
        'daily_return', 'acc_return', 'cagr',
        'daily_return_usd', 'acc_return_usd', 'cagr_usd',
    ]

    def __repr__(self):
        return f'{self.date} - portfolio {self.portfolio_id} - {self.acc_return:.4%}'


class CategoryReturn(Base):
    __tablename__ = 'category_return'
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    portfolio_id = Column(Integer, ForeignKey('portfolio.portfolio.id'), nullable=False)
    custom_category_id = Column(Integer, ForeignKey('portfolio.custom_category.id'), nullable=False)
    date = Column(Date, nullable=False)
    daily_return = Column(Float, nullable=False)
    acc_return = Column(Float, nullable=False)
    cagr = Column(Float, nullable=True)

    daily_return_usd = Column(Float, nullable=True)
    acc_return_usd = Column(Float, nullable=True)
    cagr_usd = Column(Float, nullable=True)

    portfolio = relationship('Portfolio')
    category = relationship('CustomCategory')

    COLUMNS = [
        'portfolio_id', 'custom_category_id', 'date',
        'daily_return', 'acc_return', 'cagr',
        'daily_return_usd', 'acc_return_usd', 'cagr_usd',
    ]

    def __repr__(self):
        return f'{self.date} - cat {self.custom_category_id} - {self.acc_return:.4%}'


class ConfigurationName(Base):
    __tablename__ = "configuration_name"
    __table_args__ = {'schema': 'portfolio'}

    id = Column(Integer, primary_key=True)
    name = Column(String(64), nullable=False, unique=True)
