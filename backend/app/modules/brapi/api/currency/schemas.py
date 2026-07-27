"""Query schemas for brapi Câmbio endpoints."""

from typing import Literal

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class CurrencyQuery(BrapiQuery):
    currency: str | None = Field(
        default=None,
        description='Par(es) de moedas separados por vírgula (ex: USD-BRL,EUR-BRL)',
        examples=['USD-BRL'],
    )


class CurrencyHistoricalQuery(BrapiQuery):
    currency: str = Field(
        default=...,
        description='Pares de moedas separados por vírgula (ex: USD-BRL,EUR-BRL). Máximo 20.',
        examples=['USD-BRL,EUR-BRL'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data de início no formato YYYY-MM-DD.',
        examples=['2024-01-01'],
        pattern='^\\d{4}-\\d{2}-\\d{2}$',
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data de fim no formato YYYY-MM-DD.',
        examples=['2024-12-31'],
        pattern='^\\d{4}-\\d{2}-\\d{2}$',
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default=None,
        alias='sortOrder',
        description='Ordem das observações pela data. Padrão: desc.',
        examples=['desc'],
    )

    limit: int | None = Field(
        default=None,
        description='Máximo de observações por par. Padrão: 365.',
        examples=[365],
        gt=0,
    )


class CurrencyAvailableQuery(BrapiQuery):
    search: str | None = Field(
        default=None,
        description='Filtrar pares de moedas por nome ou descrição',
        examples=['USD'],
    )
