"""Query schemas for brapi Opções sobre futuros endpoints."""

from typing import Literal

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class FutureOptionExpirationsQuery(BrapiQuery):
    underlying: str = Field(
        default=...,
        description='Código do ativo (ex.: `BGI`, `ICF`).',
        examples=['BGI'],
    )

    include_expired: Literal['true', 'false'] | None = Field(
        default='false',
        alias='includeExpired',
        description='`true` inclui vencimentos passados. Padrão: `false`.',
    )


class FutureOptionStrikesQuery(BrapiQuery):
    underlying: str = Field(
        default=...,
        description='Código do ativo (ex.: `BGI`).',
        examples=['BGI'],
    )

    expiration_date: str = Field(
        default=...,
        alias='expirationDate',
        description='Data de vencimento (YYYY-MM-DD).',
        examples=['2026-08-31'],
    )

    side: Literal['call', 'put'] | None = Field(
        default=None,
        description='Filtra por `call` ou `put`.',
    )


class FutureOptionChainQuery(BrapiQuery):
    underlying: str = Field(
        default=...,
        description='Código do ativo (ex.: `BGI`).',
        examples=['BGI'],
    )

    expiration_date: str = Field(
        default=...,
        alias='expirationDate',
        description='Data de vencimento (YYYY-MM-DD).',
        examples=['2026-08-31'],
    )

    date: str | None = Field(
        default=None,
        description='Data da cotação (YYYY-MM-DD). Padrão: último pregão.',
    )

    side: Literal['call', 'put'] | None = Field(
        default=None,
        description='Filtra por `call` ou `put`.',
    )

    min_strike: float | None = Field(
        default=None,
        alias='minStrike',
        description='Strike mínimo (em reais).',
    )

    max_strike: float | None = Field(
        default=None,
        alias='maxStrike',
        description='Strike máximo (em reais).',
    )


class FutureOptionHistoricalQuery(BrapiQuery):
    symbol: str = Field(
        default=...,
        description='Código da opção (ex.: `BGIM26C028000`).',
        examples=['BGIM26C028000'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial (YYYY-MM-DD). Padrão: 12 meses atrás.',
        examples=['2026-05-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final (YYYY-MM-DD). Padrão: hoje.',
        examples=['2026-06-01'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
    )


class FutureOptionAnalyticsQuery(BrapiQuery):
    underlying: str = Field(
        default=...,
        description='Código do ativo (ex.: `BGI`).',
        examples=['BGI'],
    )

    expiration_date: str = Field(
        default=...,
        alias='expirationDate',
        description='Data de vencimento (YYYY-MM-DD).',
        examples=['2026-08-31'],
    )

    date: str | None = Field(
        default=None,
        description='Data da cotação (YYYY-MM-DD). Padrão: último pregão.',
    )

    side: Literal['call', 'put'] | None = Field(
        default=None,
        description='Filtra por `call` ou `put`.',
    )

    min_strike: float | None = Field(
        default=None,
        alias='minStrike',
        description='Strike mínimo (em reais).',
    )

    max_strike: float | None = Field(
        default=None,
        alias='maxStrike',
        description='Strike máximo (em reais).',
    )

    limit: int | None = Field(
        default=None,
        description='Limita a quantidade de séries retornadas na cadeia analítica. Padrão: todas as séries do filtro.',
        examples=[50],
        ge=1,
        le=500,
    )


class FutureOptionAnalyticsHistoryQuery(BrapiQuery):
    symbol: str = Field(
        default=...,
        description='Código da opção (ex.: `BGIM26C028000`).',
        examples=['BGIM26C028000'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial (YYYY-MM-DD). Padrão: 12 meses atrás.',
        examples=['2026-05-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final (YYYY-MM-DD). Padrão: hoje.',
        examples=['2026-06-01'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
    )
