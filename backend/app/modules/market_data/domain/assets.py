from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.modules.market_data.domain.enums import AssetStatus
from app.modules.market_data.domain.fund_registry import (
    FundRegistry,
    FundRegistryClass,
    FundRegistrySubclass,
    FundShareSeries,
)


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
class Institution:
    """Uma pessoa jurídica: companhia emissora, administradora, gestora.

    Não carrega o papel que exerce. O papel é quem aponta para ela — emissora
    de um ativo, administradora de um fundo — porque a mesma instituição
    costuma exercer mais de um, e uma coluna de papel mentiria para essa.
    """

    id: int | None = None
    cnpj: str
    #: Nome de exibição: o comercial quando existe, senão a razão social.
    name: str
    legal_name: str
    #: Presente só para companhia registrada na CVM. É também o que distingue
    #: uma companhia de uma administradora, sem coluna de papel.
    cvm_code: str | None = None
    country: str = 'BR'
    status: str | None = None
    registered_at: date | None = None
    refreshed_at: datetime | None = None

    def __repr__(self) -> str:
        return f'{self.name} ({self.cnpj})'


@dataclass(eq=False, kw_only=True)
class Asset:
    id: int | None = None
    ticker: str | None = None
    name: str
    asset_type_id: int
    exchange_id: int | None = None
    logo_url: str | None = None
    #: Quem emitiu o papel, quando não é o próprio ativo. Uma ação aponta para
    #: a companhia; um FII não, porque o fundo é o ativo.
    institution_id: int | None = None
    status: str = AssetStatus.ACTIVE
    summary: str | None = None
    description: str | None = None
    asset_type: AssetType | None = None
    exchange: Exchange | None = None
    institution: Institution | None = None
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
    #: ON, PN, PNA, UNIT — o que separa ITUB3 de ITUB4.
    share_class: str | None = None
    listing_segment: str | None = None
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
    #: O fundo no cadastro do regulador, que já está no banco. Nulo para ETF
    #: de fora, que não é registrado aqui.
    fund_registry_id: int | None = None
    segment: ETFSegment | None = None
    registry_fund: FundRegistry | None = None
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
    #: O fundo no cadastro do regulador, que já está no banco.
    fund_registry_id: int | None = None
    segment: FIISegment | None = None
    registry_fund: FundRegistry | None = None
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
    #: Typed by hand. Kept as the fallback for funds the registry does not
    #: classify: a manual fund, or a registry class with an empty classification.
    anbima_category: str | None = None
    #: The priced unit in the fund registry. All null for a fund registered by
    #: hand, which keeps being identified by ``legal_id``.
    fund_registry_class_id: int | None = None
    fund_registry_subclass_id: int | None = None
    fund_share_series_id: int | None = None
    #: Incremented whenever what identifies the priced unit changes (CNPJ,
    #: subclass, series or its confirmed aliases), so share values applied under
    #: the previous identity are no longer taken as covered.
    selection_version: int = 1
    asset: Asset | None = None
    registry_class: FundRegistryClass | None = None
    registry_subclass: FundRegistrySubclass | None = None
    share_series: FundShareSeries | None = None

    def anbima_classification(self) -> str | None:
        """The ANBIMA classification: the registry's when it has one, else the typed one."""
        if self.registry_class is not None and self.registry_class.anbima_classification:
            return self.registry_class.anbima_classification
        return self.anbima_category


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
