from sqlalchemy import inspect
from sqlalchemy.orm import relationship

from app.infra.db.base import Base
from app.infra.db.tables.assets import (
    asset_class_table,
    asset_table,
    asset_type_table,
    broker_table,
    currency_table,
    etf_segment_table,
    etf_table,
    event_table,
    exchange_table,
    fii_segment_table,
    fii_table,
    fii_type_table,
    fixed_income_table,
    fixed_income_type_table,
    investment_fund_table,
    stock_table,
    treasury_bond_table,
    treasury_bond_type_table,
)
from app.modules.market_data.domain.assets import (
    Asset,
    AssetClass,
    AssetType,
    Broker,
    Currency,
    ETF,
    ETFSegment,
    Event,
    Exchange,
    FII,
    FIISegment,
    FIIType,
    FixedIncome,
    FixedIncomeType,
    InvestmentFund,
    Stock,
    TreasuryBond,
    TreasuryBondType,
)
from app.modules.market_data.domain.market_data_series import MarketDataSeries


def map_assets() -> None:
    if inspect(Asset, raiseerr=False) is not None:
        return

    Base.registry.map_imperatively(Exchange, exchange_table)
    Base.registry.map_imperatively(AssetClass, asset_class_table)
    Base.registry.map_imperatively(
        AssetType,
        asset_type_table,
        properties={'asset_class': relationship(AssetClass, lazy='joined')},
    )
    Base.registry.map_imperatively(Currency, currency_table)
    Base.registry.map_imperatively(Event, event_table)
    Base.registry.map_imperatively(ETFSegment, etf_segment_table)
    Base.registry.map_imperatively(FIIType, fii_type_table)
    Base.registry.map_imperatively(
        FIISegment,
        fii_segment_table,
        properties={'type': relationship(FIIType, lazy='joined')},
    )
    Base.registry.map_imperatively(
        FixedIncomeType,
        fixed_income_type_table,
        properties={
            'fixed_incomes': relationship(
                FixedIncome,
                back_populates='fixed_income_type',
            ),
        },
    )
    Base.registry.map_imperatively(
        TreasuryBondType,
        treasury_bond_type_table,
        properties={
            'treasury_bonds': relationship(
                TreasuryBond,
                back_populates='type',
            ),
        },
    )
    Base.registry.map_imperatively(
        Asset,
        asset_table,
        properties={
            'asset_type': relationship(AssetType, lazy='joined'),
            'exchange': relationship(Exchange, lazy='joined'),
            'stock': relationship(Stock, back_populates='asset', uselist=False),
            'fii': relationship(FII, back_populates='asset', uselist=False),
            'etf': relationship(ETF, back_populates='asset', uselist=False),
            'fund': relationship(InvestmentFund, back_populates='asset', uselist=False),
            'fixed_income': relationship(
                FixedIncome,
                back_populates='asset',
                uselist=False,
                cascade='all, delete-orphan',
            ),
            'treasury_bond': relationship(
                TreasuryBond,
                back_populates='asset',
                uselist=False,
            ),
        },
    )
    Base.registry.map_imperatively(
        Stock,
        stock_table,
        properties={'asset': relationship(Asset, back_populates='stock')},
    )
    Base.registry.map_imperatively(
        ETF,
        etf_table,
        properties={
            'segment': relationship(ETFSegment, lazy='joined'),
            'asset': relationship(Asset, back_populates='etf'),
        },
    )
    Base.registry.map_imperatively(
        FII,
        fii_table,
        properties={
            'segment': relationship(FIISegment, lazy='joined'),
            'asset': relationship(Asset, back_populates='fii', lazy='joined'),
        },
    )
    Base.registry.map_imperatively(
        FixedIncome,
        fixed_income_table,
        properties={
            'asset': relationship(Asset, back_populates='fixed_income'),
            'fixed_income_type': relationship(
                FixedIncomeType,
                back_populates='fixed_incomes',
            ),
            'index': relationship(MarketDataSeries, lazy='joined'),
        },
    )
    Base.registry.map_imperatively(
        InvestmentFund,
        investment_fund_table,
        properties={'asset': relationship(Asset, back_populates='fund')},
    )
    Base.registry.map_imperatively(
        TreasuryBond,
        treasury_bond_table,
        properties={
            'type': relationship(
                TreasuryBondType,
                back_populates='treasury_bonds',
                lazy='joined',
            ),
            'asset': relationship(Asset, back_populates='treasury_bond'),
        },
    )
    Base.registry.map_imperatively(
        Broker,
        broker_table,
        properties={'currency': relationship(Currency, lazy='joined')},
    )
