"""Asset domain schemas (assets, types, FII/ETF/fixed income, events, exchanges)."""

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AssetClass(BaseModel):
    id: int
    name: str


class AssetType(BaseModel):
    id: int
    short_name: str
    name: str
    asset_class_id: int
    asset_class: AssetClass

    model_config = ConfigDict(from_attributes=True)


class Asset(BaseModel):
    id: int
    ticker: str
    name: str
    asset_type_id: int

    asset_type: AssetType

    model_config = ConfigDict(from_attributes=True)


class AssetClassOut(BaseModel):
    id: int
    name: str
    model_config = {'from_attributes': True}


class AssetTypeOut(BaseModel):
    id: int
    asset_class_id: int
    short_name: str
    name: str
    asset_class: AssetClassOut
    model_config = {'from_attributes': True}


class CurrencyOut(BaseModel):
    id: int
    code: str
    name: str
    model_config = {'from_attributes': True}


class StockOut(BaseModel):
    asset_id: int
    sector: Optional[str]
    country: Optional[str]
    industry: Optional[str]
    model_config = {'from_attributes': True}


class InvestmentFundOut(BaseModel):
    asset_id: int
    legal_id: Optional[str]
    anbima_code: Optional[str]
    anbima_code_class: Optional[str]
    anbima_category: Optional[str]
    model_config = {'from_attributes': True}


class FixedIncomeTypeOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    model_config = {'from_attributes': True}


class IndexCurrencyOut(BaseModel):
    id: int
    code: str
    name: str
    model_config = {'from_attributes': True}


class IndexOut(BaseModel):
    id: int
    name: str
    short_name: Optional[str]
    symbol: Optional[str]
    currency_id: int
    currency: IndexCurrencyOut
    model_config = {'from_attributes': True}


class FixedIncomeOut(BaseModel):
    asset_id: int
    index_id: Optional[int]
    fixed_income_type_id: Optional[int]
    maturity_date: Optional[date]
    fee: Optional[float]
    fixed_income_type: Optional[FixedIncomeTypeOut]
    index: Optional[IndexOut]
    model_config = {'from_attributes': True}


class TreasuryBondTypeOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str]
    model_config = {'from_attributes': True}


class TreasuryBondOut(BaseModel):
    id: int
    asset_id: int
    type_id: int
    maturity_date: Optional[date]
    type: TreasuryBondTypeOut
    model_config = {'from_attributes': True}


class FIITypeOut(BaseModel):
    id: int
    name: str
    model_config = {'from_attributes': True}


class FIISegmentOut(BaseModel):
    id: int
    name: str
    type_id: int
    type: FIITypeOut
    model_config = {'from_attributes': True}


class FIIOut(BaseModel):
    asset_id: int
    segment_id: int
    segment: FIISegmentOut
    model_config = {'from_attributes': True}


class ETFSegmentOut(BaseModel):
    id: int
    name: str
    model_config = {'from_attributes': True}


class ETFOut(BaseModel):
    asset_id: int
    segment_id: Optional[int]
    segment: Optional[ETFSegmentOut]
    model_config = {'from_attributes': True}


class AssetDetailsOut(BaseModel):
    id: int
    ticker: Optional[str]
    name: str
    asset_type_id: int
    exchange_id: Optional[int] = None

    asset_type: AssetTypeOut

    stock: Optional[StockOut] = None
    fund: Optional[InvestmentFundOut] = None
    fixed_income: Optional[FixedIncomeOut] = None
    treasury_bond: Optional[TreasuryBondOut] = None
    fii: Optional[FIIOut] = None
    etf: Optional[ETFOut] = None

    model_config = {'from_attributes': True}


class AssetDetailsWithPosition(AssetDetailsOut):
    quantity: float = 0.0
    price: float = 0.0
    average_price: float = 0.0
    value: float = 0.0
    acc_return: float = 0.0
    twelve_months_return: Optional[float] = None
    cagr: Optional[float] = None


class AssetEvent(BaseModel):
    id: Optional[int]
    asset_id: int
    date: date
    factor: float
    type: str

    model_config = {'from_attributes': True}


class FixedIncomeType(BaseModel):
    id: int
    name: str
    description: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class FixedIncomeAsset(BaseModel):
    name: str
    ticker: str
    maturity_date: date
    fee: float
    index_id: Optional[int]
    fixed_income_type_id: int
    asset_type_id: int

    model_config = ConfigDict(from_attributes=True)


class AssetCreate(BaseModel):
    ticker: Optional[str] = None
    name: str
    asset_type_id: int
    exchange_id: Optional[int] = None

    # Stock
    country: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None

    # FII
    fii_segment_id: Optional[int] = None

    # ETF
    etf_segment_id: Optional[int] = None

    # Fixed Income
    maturity_date: Optional[date] = None
    fee: Optional[float] = None
    index_id: Optional[int] = None
    fixed_income_type_id: Optional[int] = None

    # Investment Fund
    legal_id: Optional[str] = None
    anbima_code: Optional[str] = None
    anbima_code_class: Optional[str] = None
    anbima_category: Optional[str] = None

    # Treasury Bond
    treasury_bond_type_id: Optional[int] = None


class AssetUpdate(AssetCreate):
    id: int


class ExchangeOut(BaseModel):
    id: int
    code: str
    name: str
    model_config = ConfigDict(from_attributes=True)
