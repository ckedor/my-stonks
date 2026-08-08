from sqlalchemy import inspect
from sqlalchemy.orm import relationship

from app.infra.db.base import Base
from app.infra.db.tables.portfolio import (
    category_return_table,
    configuration_name_table,
    custom_category_assignment_table,
    custom_category_table,
    dividend_table,
    portfolio_return_table,
    portfolio_table,
    portfolio_user_configuration_table,
    position_table,
    return_12m_table,
    transaction_table,
)
from app.modules.market_data.domain.assets import Asset, Broker
from app.modules.market_data.domain.market_data_series import MarketDataSeries
from app.modules.portfolio.domain.entities import (
    CategoryReturn,
    ConfigurationName,
    CustomCategory,
    CustomCategoryAssignment,
    Dividend,
    Portfolio,
    PortfolioReturn,
    PortfolioUserConfiguration,
    Position,
    Return12M,
    Transaction,
)
from app.modules.users.domain import User


def map_portfolio() -> None:
    if inspect(Portfolio, raiseerr=False) is not None:
        return

    Base.registry.map_imperatively(ConfigurationName, configuration_name_table)
    Base.registry.map_imperatively(
        Portfolio,
        portfolio_table,
        properties={
            'positions': relationship(Position, back_populates='portfolio'),
            'transactions': relationship(Transaction, back_populates='portfolio'),
            'dividends': relationship(Dividend, back_populates='portfolio'),
            'returns': relationship(Return12M, back_populates='portfolio'),
            'custom_categories': relationship(CustomCategory, back_populates='portfolio'),
            'user': relationship(User),
        },
    )
    Base.registry.map_imperatively(
        Position,
        position_table,
        properties={
            'portfolio': relationship(Portfolio, back_populates='positions'),
            'asset': relationship(Asset),
        },
    )
    Base.registry.map_imperatively(
        Transaction,
        transaction_table,
        properties={
            'portfolio': relationship(Portfolio, back_populates='transactions'),
            'asset': relationship(Asset),
            'broker': relationship(Broker),
        },
    )
    Base.registry.map_imperatively(
        Dividend,
        dividend_table,
        properties={
            'portfolio': relationship(Portfolio, back_populates='dividends'),
            'asset': relationship(Asset),
        },
    )
    Base.registry.map_imperatively(
        Return12M,
        return_12m_table,
        properties={'portfolio': relationship(Portfolio, back_populates='returns')},
    )
    Base.registry.map_imperatively(
        CustomCategory,
        custom_category_table,
        properties={
            'portfolio': relationship(
                Portfolio,
                back_populates='custom_categories',
                lazy='joined',
            ),
            'assignments': relationship(
                CustomCategoryAssignment,
                back_populates='category',
            ),
            'benchmark': relationship(MarketDataSeries, lazy='joined'),
        },
    )
    Base.registry.map_imperatively(
        CustomCategoryAssignment,
        custom_category_assignment_table,
        properties={
            'category': relationship(
                CustomCategory,
                back_populates='assignments',
                lazy='joined',
            ),
            'asset': relationship(Asset),
        },
    )
    Base.registry.map_imperatively(
        PortfolioUserConfiguration,
        portfolio_user_configuration_table,
        properties={
            'configuration_name': relationship(ConfigurationName, lazy='joined'),
        },
    )
    Base.registry.map_imperatively(
        PortfolioReturn,
        portfolio_return_table,
        properties={'portfolio': relationship(Portfolio)},
    )
    Base.registry.map_imperatively(
        CategoryReturn,
        category_return_table,
        properties={
            'portfolio': relationship(Portfolio),
            'category': relationship(CustomCategory),
        },
    )
