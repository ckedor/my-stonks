from pydantic import BaseModel


class CustomCategory(BaseModel):
    id: int | None = None
    name: str
    color: str
    portfolio_id: int
    benchmark_id: int


class SaveCategoriesRequest(BaseModel):
    categories: list[CustomCategory]


class CategoryAssignmentRequest(BaseModel):
    asset_id: int
    category_id: int
    portfolio_id: int
