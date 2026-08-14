from pydantic import BaseModel, ConfigDict

from app.modules.market_data.api.index.schemas import Currency
from app.modules.portfolio.domain.category import NewCategory
from app.modules.portfolio.domain.entities import CustomCategory as CustomCategoryEntity


class CustomCategory(BaseModel):
    id: int | None = None
    name: str
    color: str
    benchmark_id: int
    portfolio_id: int | None = None


class CreatePortfolioRequest(BaseModel):
    name: str
    user_categories: list[CustomCategory]

    def categories_to_domain(self) -> list[NewCategory]:
        return [
            NewCategory(name=c.name, color=c.color, benchmark_id=c.benchmark_id)
            for c in self.user_categories
        ]


class UpdatePortfolioRequest(BaseModel):
    id: int
    name: str
    user_categories: list[CustomCategory] | None = None

    def categories_to_domain(self) -> list[CustomCategoryEntity]:
        return [
            CustomCategoryEntity(
                id=c.id,
                name=c.name,
                color=c.color,
                benchmark_id=c.benchmark_id,
                portfolio_id=c.portfolio_id,
            )
            for c in self.user_categories or []
        ]


class Benchmark(BaseModel):
    id: int
    name: str
    short_name: str
    symbol: str
    currency_id: int | None = None
    currency: Currency | None = None

    model_config = ConfigDict(from_attributes=True)


class CustomCategory(BaseModel):
    id: int | None = None
    name: str
    color: str
    benchmark_id: int
    portfolio_id: int | None = None
    benchmark: Benchmark | None = None

    model_config = ConfigDict(from_attributes=True)


class Portfolio(BaseModel):
    id: int
    name: str
    user_id: int
    custom_categories: list[CustomCategory] = []

    model_config = ConfigDict(from_attributes=True)


class PortfolioSummary(BaseModel):
    """Portfolio identity without its categories, for administrative listings."""

    id: int
    name: str
    user_id: int

    model_config = ConfigDict(from_attributes=True)
