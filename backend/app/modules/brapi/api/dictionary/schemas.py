"""Query schemas for brapi Dicionário endpoints."""

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class DictionaryQuery(BrapiQuery):
    search: str | None = Field(
        default=None,
        description='Termo de busca para filtrar campos (busca em key, label, description e category)',
        examples=['patrimônio'],
    )

    category: str | None = Field(
        default=None,
        description='Filtrar por categoria (ex: fii, treasury, quote, balance-sheet, income-statement)',
        examples=['treasury'],
    )
