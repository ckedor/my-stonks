"""Asset domain schemas (assets, types, FII/ETF/fixed income, events, exchanges)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class AssetClass(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


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


class InstitutionOut(BaseModel):
    """Uma pessoa jurídica: companhia emissora, administradora, gestora."""

    id: int
    cnpj: str
    name: str
    legal_name: str
    cvm_code: str | None = None
    country: str
    status: str | None = None
    model_config = ConfigDict(from_attributes=True)


class StockOut(BaseModel):
    asset_id: int
    sector: str | None
    country: str | None
    industry: str | None
    share_class: str | None = None
    listing_segment: str | None = None
    model_config = {'from_attributes': True}


class InvestmentFundOut(BaseModel):
    asset_id: int
    legal_id: str | None
    anbima_category: str | None
    fund_registry_class_id: int | None = None
    fund_registry_subclass_id: int | None = None
    fund_share_series_id: int | None = None
    model_config = {'from_attributes': True}


class FixedIncomeTypeOut(BaseModel):
    id: int
    name: str
    description: str | None
    model_config = {'from_attributes': True}


class IndexCurrencyOut(BaseModel):
    id: int
    code: str
    name: str
    model_config = {'from_attributes': True}


class IndexOut(BaseModel):
    id: int
    name: str
    short_name: str | None
    symbol: str | None
    currency_id: int
    currency: IndexCurrencyOut
    model_config = {'from_attributes': True}


class FixedIncomeOut(BaseModel):
    asset_id: int
    index_id: int | None
    fixed_income_type_id: int | None
    maturity_date: date | None
    fee: float | None
    fixed_income_type: FixedIncomeTypeOut | None
    index: IndexOut | None
    model_config = {'from_attributes': True}


class TreasuryBondTypeOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None
    model_config = {'from_attributes': True}


class TreasuryBondOut(BaseModel):
    id: int
    asset_id: int
    type_id: int
    maturity_date: date | None
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
    fund_registry_id: int | None = None
    segment: FIISegmentOut
    model_config = {'from_attributes': True}


class ETFSegmentOut(BaseModel):
    id: int
    name: str
    model_config = {'from_attributes': True}


class ETFOut(BaseModel):
    asset_id: int
    segment_id: int | None
    fund_registry_id: int | None = None
    segment: ETFSegmentOut | None
    model_config = {'from_attributes': True}


class AssetDetailsOut(BaseModel):
    id: int
    ticker: str | None
    name: str
    asset_type_id: int
    exchange_id: int | None = None
    logo_url: str | None = None
    institution_id: int | None = None
    status: str = 'active'
    summary: str | None = None
    description: str | None = None

    asset_type: AssetTypeOut

    institution: InstitutionOut | None = None
    stock: StockOut | None = None
    fund: InvestmentFundOut | None = None
    fixed_income: FixedIncomeOut | None = None
    treasury_bond: TreasuryBondOut | None = None
    fii: FIIOut | None = None
    etf: ETFOut | None = None

    model_config = {'from_attributes': True}


class AssetDetailsWithPosition(AssetDetailsOut):
    quantity: float = 0.0
    price: float = 0.0
    average_price: float = 0.0
    value: float = 0.0
    acc_return: float = 0.0
    twelve_months_return: float | None = None
    cagr: float | None = None


class AssetEvent(BaseModel):
    id: int | None
    asset_id: int
    date: date
    factor: float
    type: str

    model_config = {'from_attributes': True}


class FixedIncomeType(BaseModel):
    id: int
    name: str
    description: str | None

    model_config = ConfigDict(from_attributes=True)


class FixedIncomeAsset(BaseModel):
    name: str
    ticker: str
    maturity_date: date
    fee: float
    index_id: int | None
    fixed_income_type_id: int
    asset_type_id: int

    model_config = ConfigDict(from_attributes=True)


class AssetCreate(BaseModel):
    ticker: str | None = None
    name: str
    asset_type_id: int
    exchange_id: int | None = None
    institution_id: int | None = None
    status: str | None = None
    # Texto de cadastro. A tela tem um botão que chama a IA para propor um
    # rascunho, mas o que chega aqui é o que o mantenedor salvou.
    summary: str | None = None
    description: str | None = None

    # Stock
    country: str | None = None
    sector: str | None = None
    industry: str | None = None

    # FII
    fii_segment_id: int | None = None

    # ETF
    etf_segment_id: int | None = None

    # Fixed Income
    maturity_date: date | None = None
    fee: float | None = None
    index_id: int | None = None
    fixed_income_type_id: int | None = None

    # Investment Fund
    legal_id: str | None = None
    anbima_category: str | None = None

    # Treasury Bond
    treasury_bond_type_id: int | None = None


class AssetUpdate(AssetCreate):
    id: int


class AssetSyncChange(BaseModel):
    """Um ativo que o catálogo corrige, com o antes e o depois de cada campo."""

    kind: str
    ticker: str
    changes: dict[str, tuple[str | None, str | None]]


class AssetSyncEntry(BaseModel):
    kind: str
    ticker: str | None = None
    name: str


class AssetSyncReport(BaseModel):
    """O que a sincronização fez — ou faria, quando `dry_run`."""

    dry_run: bool
    kinds: list[str]
    created: list[AssetSyncEntry]
    updated: list[AssetSyncChange]
    unchanged: int
    kept_local: list[AssetSyncEntry]


class ExchangeOut(BaseModel):
    id: int
    code: str
    name: str
    model_config = ConfigDict(from_attributes=True)


class FavoriteAssetType(BaseModel):
    id: int
    short_name: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class FavoriteAssetFilters(BaseModel):
    limit: int = Field(default=8, ge=1, le=24)
    asset_type_id: int | None = Field(default=None, ge=1)
    asset_ids: list[int] | None = Field(default=None, max_length=1000)
    brazilian: bool | None = None


class FavoriteAsset(BaseModel):
    """An asset the user returns to, ranked by how often they open it."""

    id: int
    ticker: str | None
    name: str
    asset_type_id: int
    logo_url: str | None = None
    asset_type: FavoriteAssetType
    visit_count: int
    last_visited_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class RegistrySyncFieldChange(BaseModel):
    """O antes e o depois de um campo que o regulador corrige."""

    cnpj: str | None = None
    ticker: str | None = None
    name: str | None = None
    changes: dict[str, tuple[str | None, str | None]]


class RegistrySyncEntry(BaseModel):
    cnpj: str | None = None
    ticker: str | None = None
    name: str | None = None
    role: str | None = None


class InstitutionSyncSection(BaseModel):
    created: list[RegistrySyncEntry]
    updated: list[RegistrySyncFieldChange]
    unchanged: int


class AssetRegistrySyncSection(BaseModel):
    updated: list[RegistrySyncFieldChange]
    unchanged: int
    unmatched: list[RegistrySyncEntry]
    #: Ativo de fora da B3 não é procurado num arquivo da CVM.
    skipped_foreign: int


class CvmRegistrySyncReport(BaseModel):
    """O que o sync do cadastro da CVM fez — ou faria, quando `dry_run`."""

    dry_run: bool
    institutions: InstitutionSyncSection
    assets: AssetRegistrySyncSection


class FundLinkCandidate(BaseModel):
    id: int
    name: str
    status: str | None = None


class FundLinkSuggestion(BaseModel):
    asset_id: int
    ticker: str
    cnpj: str
    fund_registry_id: int | None = None
    fund_registry_name: str | None = None
    candidates: list[FundLinkCandidate] | None = None


class FundLinkSuggestionReport(BaseModel):
    """As propostas de vínculo entre um FII e o fundo que o regulador registrou.

    `ambiguous` é um CNPJ que aponta para mais de um registro e `unknown` é um
    que o registro não conhece. Nenhum dos dois vira palpite.
    """

    suggestions: list[FundLinkSuggestion]
    ambiguous: list[FundLinkSuggestion]
    unknown: list[FundLinkSuggestion]
    already_linked: int


class FundLinkRequest(BaseModel):
    asset_id: int
    fund_registry_id: int


class FundLinkResult(BaseModel):
    asset_id: int
    fund_registry_id: int
    cnpj: str
    name: str


class RegisteredFundOut(BaseModel):
    """Um fundo do cadastro do regulador, como a busca manual o devolve."""

    id: int
    cnpj: str
    name: str
    kind: str
    status: str
    administrator_name: str | None = None
    manager_name: str | None = None
    model_config = ConfigDict(from_attributes=True)
