from pydantic import BaseModel


class MarketCatalogueAssetResponse(BaseModel):
    asset_id: int | None = None
    ticker: str
    name: str
    price: float | None = None
    change_percent: float | None = None
    volume: float | None = None
    market_cap: float | None = None
    currency: str
    logo_url: str | None = None


class MarketCatalogueResponse(BaseModel):
    assets: list[MarketCatalogueAssetResponse]
    total: int
    source: str
