from pydantic import BaseModel, ConfigDict

from app.modules.portfolio.domain.rebalancing import AssetTarget, CategoryTarget


class AssetTargetRequest(BaseModel):
    asset_id: int
    target_percentage: float


class CategoryTargetRequest(BaseModel):
    category_id: int
    target_percentage: float
    assets: list[AssetTargetRequest]


class SaveTargetsRequest(BaseModel):
    portfolio_id: int
    categories: list[CategoryTargetRequest]

    def categories_to_domain(self) -> list[CategoryTarget]:
        return [
            CategoryTarget(
                category_id=c.category_id,
                target_percentage=c.target_percentage,
                assets=[
                    AssetTarget(
                        asset_id=a.asset_id,
                        target_percentage=a.target_percentage,
                    )
                    for a in c.assets
                ],
            )
            for c in self.categories
        ]


class AssetRebalancingEntry(BaseModel):
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

    model_config = ConfigDict(from_attributes=True)


class CategoryRebalancingEntry(BaseModel):
    category_id: int
    category_name: str
    color: str
    current_value: float
    current_pct: float
    target_pct: float | None
    target_value: float | None
    diff_pct: float | None
    diff_value: float | None
    assets: list[AssetRebalancingEntry]

    model_config = ConfigDict(from_attributes=True)


class RebalancingResponse(BaseModel):
    portfolio_id: int
    total_value: float
    categories: list[CategoryRebalancingEntry]

    model_config = ConfigDict(from_attributes=True)
