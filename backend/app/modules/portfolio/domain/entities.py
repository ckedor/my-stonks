from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, ClassVar


@dataclass(eq=False, kw_only=True)
class Portfolio:
    id: int | None = None
    name: str
    user_id: int
    positions: list[Position] = field(default_factory=list)
    transactions: list[Transaction] = field(default_factory=list)
    dividends: list[Dividend] = field(default_factory=list)
    returns: list[Return12M] = field(default_factory=list)
    custom_categories: list[CustomCategory] = field(default_factory=list)
    user: Any | None = None

    def __repr__(self) -> str:
        return self.name


@dataclass(eq=False, kw_only=True)
class Position:
    id: int | None = None
    portfolio_id: int
    asset_id: int
    date: date
    quantity: float
    price: float
    average_price: float
    daily_return: float
    acc_return: float
    twelve_months_return: float | None = None
    cagr: float | None = None
    price_usd: float
    average_price_usd: float
    daily_return_usd: float
    acc_return_usd: float
    twelve_months_return_usd: float | None = None
    cagr_usd: float | None = None
    total_invested: float | None = None
    total_invested_usd: float | None = None
    portfolio: Portfolio | None = None
    asset: Any | None = None

    COLUMNS: ClassVar[list[str]] = [
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


@dataclass(eq=False, kw_only=True)
class Transaction:
    id: int | None = None
    portfolio_id: int
    asset_id: int
    broker_id: int
    date: datetime
    quantity: float
    price: float
    price_usd: float | None = None
    portfolio: Portfolio | None = None
    asset: Any | None = None
    broker: Any | None = None


@dataclass(eq=False, kw_only=True)
class Dividend:
    id: int | None = None
    portfolio_id: int
    asset_id: int
    date: date
    amount: float
    amount_usd: float | None = None
    portfolio: Portfolio | None = None
    asset: Any | None = None


@dataclass(eq=False, kw_only=True)
class Return12M:
    id: int | None = None
    portfolio_id: int
    date: date
    return_pct: float
    portfolio: Portfolio | None = None


@dataclass(eq=False, kw_only=True)
class CustomCategory:
    id: int | None = None
    name: str
    portfolio_id: int
    color: str = '#000'
    benchmark_id: int | None = None
    target_percentage: float | None = None
    portfolio: Portfolio | None = None
    assignments: list[CustomCategoryAssignment] = field(default_factory=list)
    benchmark: Any | None = None


@dataclass(eq=False, kw_only=True)
class CustomCategoryAssignment:
    id: int | None = None
    custom_category_id: int
    asset_id: int
    target_percentage: float | None = None
    category: CustomCategory | None = None
    asset: Any | None = None


@dataclass(eq=False, kw_only=True)
class PortfolioUserConfiguration:
    id: int | None = None
    portfolio_id: int
    configuration_name_id: int
    enabled: bool = False
    config_data: dict | None = None
    configuration_name: ConfigurationName | None = None


@dataclass(eq=False, kw_only=True)
class PortfolioReturn:
    id: int | None = None
    portfolio_id: int
    date: date
    daily_return: float
    acc_return: float
    cagr: float | None = None
    daily_return_usd: float | None = None
    acc_return_usd: float | None = None
    cagr_usd: float | None = None
    portfolio: Portfolio | None = None

    COLUMNS: ClassVar[list[str]] = [
        'portfolio_id',
        'date',
        'daily_return',
        'acc_return',
        'cagr',
        'daily_return_usd',
        'acc_return_usd',
        'cagr_usd',
    ]


@dataclass(eq=False, kw_only=True)
class CategoryReturn:
    id: int | None = None
    portfolio_id: int
    custom_category_id: int
    date: date
    daily_return: float
    acc_return: float
    cagr: float | None = None
    daily_return_usd: float | None = None
    acc_return_usd: float | None = None
    cagr_usd: float | None = None
    portfolio: Portfolio | None = None
    category: CustomCategory | None = None

    COLUMNS: ClassVar[list[str]] = [
        'portfolio_id',
        'custom_category_id',
        'date',
        'daily_return',
        'acc_return',
        'cagr',
        'daily_return_usd',
        'acc_return_usd',
        'cagr_usd',
    ]


@dataclass(eq=False, kw_only=True)
class ConfigurationName:
    id: int | None = None
    name: str
