from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any


@dataclass(eq=False, kw_only=True)
class Exchange:
    id: int | None = None
    code: str
    name: str

    def __repr__(self) -> str:
        return self.code


@dataclass(eq=False, kw_only=True)
class AssetClass:
    id: int | None = None
    name: str

    def __repr__(self) -> str:
        return self.name


@dataclass(eq=False, kw_only=True)
class AssetType:
    id: int | None = None
    short_name: str
    name: str
    asset_class_id: int
    asset_class: AssetClass | None = None

    def __repr__(self) -> str:
        return f'{self.short_name} - {self.name}'


@dataclass(eq=False, kw_only=True)
class Currency:
    id: int | None = None
    code: str
    name: str

    def __repr__(self) -> str:
        return self.code


@dataclass(eq=False, kw_only=True)
class Event:
    id: int | None = None
    asset_id: int
    date: date
    type: str
    factor: float


@dataclass(eq=False, kw_only=True)
class Asset:
    id: int | None = None
    ticker: str | None = None
    name: str
    asset_type_id: int
    exchange_id: int | None = None
    asset_type: AssetType | None = None
    exchange: Exchange | None = None
    stock: Stock | None = None
    fii: FII | None = None
    etf: ETF | None = None
    fund: InvestmentFund | None = None
    fixed_income: FixedIncome | None = None
    treasury_bond: TreasuryBond | None = None

    def __repr__(self) -> str:
        return f'{self.ticker} - {self.name}'


@dataclass(eq=False, kw_only=True)
class Stock:
    asset_id: int
    country: str | None = None
    sector: str | None = None
    industry: str | None = None
    asset: Asset | None = None


@dataclass(eq=False, kw_only=True)
class ETFSegment:
    id: int | None = None
    name: str

    def __repr__(self) -> str:
        return self.name


@dataclass(eq=False, kw_only=True)
class ETF:
    asset_id: int
    segment_id: int | None = None
    segment: ETFSegment | None = None
    asset: Asset | None = None


@dataclass(eq=False, kw_only=True)
class FIIType:
    id: int | None = None
    name: str

    def __repr__(self) -> str:
        return self.name


@dataclass(eq=False, kw_only=True)
class FIISegment:
    id: int | None = None
    name: str
    type_id: int | None = None
    type: FIIType | None = None

    def __repr__(self) -> str:
        return f'{self.name} - {self.type.name}' if self.type else self.name


@dataclass(eq=False, kw_only=True)
class FII:
    asset_id: int
    segment_id: int
    segment: FIISegment | None = None
    asset: Asset | None = None

    def __repr__(self) -> str:
        return f'FII: {self.asset.ticker}' if self.asset else f'FII: {self.asset_id}'


@dataclass(eq=False, kw_only=True)
class FixedIncomeType:
    id: int | None = None
    name: str
    description: str | None = None
    fixed_incomes: list[FixedIncome] = field(default_factory=list)

    def __repr__(self) -> str:
        return self.name


@dataclass(eq=False, kw_only=True)
class FixedIncome:
    asset_id: int
    maturity_date: date | None = None
    fee: Decimal | float | None = None
    index_id: int | None = None
    fixed_income_type_id: int | None = None
    asset: Asset | None = None
    fixed_income_type: FixedIncomeType | None = None
    index: Any | None = None

    def __repr__(self) -> str:
        return (
            f'FixedIncome: {self.asset.ticker}' if self.asset else f'FixedIncome: {self.asset_id}'
        )


@dataclass(eq=False, kw_only=True)
class InvestmentFund:
    asset_id: int
    legal_id: str | None = None
    anbima_code: str | None = None
    anbima_code_class: str | None = None
    anbima_category: str | None = None
    asset: Asset | None = None


@dataclass(eq=False, kw_only=True)
class TreasuryBondType:
    id: int | None = None
    code: str
    name: str
    description: str | None = None
    treasury_bonds: list[TreasuryBond] = field(default_factory=list)

    def __repr__(self) -> str:
        return self.name


@dataclass(eq=False, kw_only=True)
class TreasuryBond:
    id: int | None = None
    asset_id: int
    maturity_date: date | None = None
    fee: Decimal | float | None = None
    type_id: int
    type: TreasuryBondType | None = None
    asset: Asset | None = None


@dataclass(eq=False, kw_only=True)
class Broker:
    id: int | None = None
    name: str
    cnpj: str | None = None
    currency_id: int
    currency: Currency | None = None

    def __repr__(self) -> str:
        return self.name
