from typing import List

from app.modules.market_data.api.index.schemas import Currency
from pydantic import BaseModel, ConfigDict


class CustomCategory(BaseModel):
    id: int | None = None
    name: str
    color: str
    benchmark_id: int
    portfolio_id: int | None = None


class CreatePortfolioRequest(BaseModel):
    name: str
    user_categories: List[CustomCategory]


class UpdatePortfolioRequest(BaseModel):
    id: int
    name: str
    user_categories: List[CustomCategory] | None = None

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
    custom_categories: List[CustomCategory] = []
    
    model_config = ConfigDict(from_attributes=True)