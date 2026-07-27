"""Query schemas for brapi Taxa de juros endpoints."""

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class PrimeRateQuery(BrapiQuery):
    historical: str | None = Field(
        default=None,
        description='Incluir dados históricos (true/false)',
        examples=['false'],
    )

    start: str | None = Field(
        default=None,
        description='Data de início (DD/MM/YYYY)',
        examples=['01/01/2023'],
    )

    end: str | None = Field(
        default=None,
        description='Data de fim (DD/MM/YYYY)',
        examples=['31/12/2023'],
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
        description='Campo para ordenação (date ou value)',
        examples=['date'],
    )

    sort_order: str | None = Field(
        default=None,
        alias='sortOrder',
        description='Ordem de classificação (asc ou desc)',
        examples=['desc'],
    )
