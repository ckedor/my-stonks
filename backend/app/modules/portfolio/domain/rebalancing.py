from dataclasses import dataclass


@dataclass(frozen=True, kw_only=True)
class AssetTarget:
    """The share an asset should hold inside its category."""

    asset_id: int
    target_percentage: float


@dataclass(frozen=True, kw_only=True)
class CategoryTarget:
    """The share a category should hold in the portfolio, and its assets' shares."""

    category_id: int
    target_percentage: float
    assets: list[AssetTarget]


@dataclass(kw_only=True)
class AssetRebalancing:
    """An asset's current share against its target, and the gap between them."""

    asset_id: int
    ticker: str
    name: str
    category: str
    category_id: int
    current_value: float
    current_pct_in_category: float
    target_pct_in_category: float | None
    target_value: float | None
    diff_pct: float | None
    diff_value: float | None


@dataclass(kw_only=True)
class CategoryRebalancing:
    """A category's current share against its target, with its assets."""

    category_id: int
    category_name: str
    color: str
    current_value: float
    current_pct: float
    target_pct: float | None
    target_value: float | None
    diff_pct: float | None
    diff_value: float | None
    assets: list[AssetRebalancing]


@dataclass(kw_only=True)
class PortfolioRebalancing:
    """Every category of a portfolio measured against its target allocation."""

    portfolio_id: int
    total_value: float
    categories: list[CategoryRebalancing]
