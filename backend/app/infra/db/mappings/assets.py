from sqlalchemy import inspect
from sqlalchemy.orm import relationship

from app.infra.db.base import Base
from app.infra.db.tables.assets import (
    asset_class_table,
    asset_table,
    asset_type_table,
    broker_table,
    currency_table,
    etf_holding_report_table,
    etf_holding_table,
    etf_registry_class_table,
    etf_registry_table,
    etf_segment_table,
    etf_table,
    event_table,
    exchange_table,
    fii_segment_table,
    fii_table,
    fii_type_table,
    fixed_income_table,
    fixed_income_type_table,
    fund_registry_class_table,
    fund_registry_subclass_table,
    fund_registry_table,
    fund_share_series_alias_table,
    fund_share_series_table,
    institution_table,
    investment_fund_table,
    stock_table,
    treasury_bond_table,
    treasury_bond_type_table,
)
from app.modules.market_data.domain.assets import (
    ETF,
    FII,
    Asset,
    AssetClass,
    AssetType,
    Broker,
    Currency,
    ETFSegment,
    Event,
    Exchange,
    FIISegment,
    FIIType,
    FixedIncome,
    FixedIncomeType,
    Institution,
    InvestmentFund,
    Stock,
    TreasuryBond,
    TreasuryBondType,
)
from app.modules.market_data.domain.etf_registry import (
    EtfHolding,
    EtfHoldingReport,
    EtfRegistry,
    EtfRegistryClass,
)
from app.modules.market_data.domain.fund_registry import (
    FundRegistry,
    FundRegistryClass,
    FundRegistrySubclass,
    FundShareSeries,
    FundShareSeriesAlias,
)
from app.modules.market_data.domain.market_data_series import MarketDataSeries


def map_assets() -> None:
    if inspect(Asset, raiseerr=False) is not None:
        return

    Base.registry.map_imperatively(Exchange, exchange_table)
    Base.registry.map_imperatively(Institution, institution_table)
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
            'institution': relationship(Institution, lazy='joined'),
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
            'registry_fund': relationship(FundRegistry, lazy='joined'),
            'registry_class': relationship(EtfRegistryClass, lazy='joined'),
            'asset': relationship(Asset, back_populates='etf'),
        },
    )
    Base.registry.map_imperatively(
        FII,
        fii_table,
        properties={
            'segment': relationship(FIISegment, lazy='joined'),
            'registry_fund': relationship(FundRegistry, lazy='joined'),
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
    Base.registry.map_imperatively(EtfRegistry, etf_registry_table)
    Base.registry.map_imperatively(EtfHoldingReport, etf_holding_report_table)
    Base.registry.map_imperatively(EtfHolding, etf_holding_table)
    Base.registry.map_imperatively(
        EtfRegistryClass,
        etf_registry_class_table,
        properties={'fund': relationship(EtfRegistry, lazy='joined')},
    )
    Base.registry.map_imperatively(FundRegistry, fund_registry_table)
    Base.registry.map_imperatively(
        FundRegistryClass,
        fund_registry_class_table,
        properties={'fund': relationship(FundRegistry, lazy='joined')},
    )
    Base.registry.map_imperatively(FundRegistrySubclass, fund_registry_subclass_table)
    Base.registry.map_imperatively(FundShareSeries, fund_share_series_table)
    Base.registry.map_imperatively(FundShareSeriesAlias, fund_share_series_alias_table)
    Base.registry.map_imperatively(
        InvestmentFund,
        investment_fund_table,
        properties={
            'asset': relationship(Asset, back_populates='fund'),
            'registry_class': relationship(
                FundRegistryClass,
                foreign_keys=[investment_fund_table.c.fund_registry_class_id],
                viewonly=True,
            ),
            'registry_subclass': relationship(
                FundRegistrySubclass,
                primaryjoin=(
                    investment_fund_table.c.fund_registry_subclass_id
                    == fund_registry_subclass_table.c.id
                ),
                foreign_keys=[investment_fund_table.c.fund_registry_subclass_id],
                viewonly=True,
            ),
            'share_series': relationship(
                FundShareSeries,
                primaryjoin=(
                    investment_fund_table.c.fund_share_series_id == fund_share_series_table.c.id
                ),
                foreign_keys=[investment_fund_table.c.fund_share_series_id],
                viewonly=True,
            ),
        },
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
