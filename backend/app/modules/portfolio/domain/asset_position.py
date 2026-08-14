from dataclasses import dataclass

from app.modules.market_data.domain.assets import Asset


@dataclass(frozen=True, kw_only=True)
class AssetPosition:
    """A registered asset together with what a portfolio currently holds of it.

    The asset half belongs to market data and is carried as its domain entity;
    the numbers are this portfolio's. Presenting the two as one record is a
    transport concern, so the flattening happens in the router.
    """

    asset: Asset
    quantity: float
    price: float
    average_price: float
    value: float
    acc_return: float | None
    twelve_months_return: float | None
    cagr: float | None
