"""Query schemas for brapi Futuros endpoints."""

from typing import Literal

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class FuturesListQuery(BrapiQuery):
    asset: str | None = Field(
        default=None,
        description='Filtra por código do ativo (ex.: `WIN`, `BGI`, `DI1`).',
        examples=['BGI'],
    )

    segment: Literal['financial', 'agribusiness'] | None = Field(
        default=None,
        description='Filtra por segmento.',
    )

    include_expired: Literal['true', 'false'] | None = Field(
        default='false',
        alias='includeExpired',
        description='`true` inclui contratos vencidos. Padrão: `false`.',
    )

    page: int | None = Field(
        default=1,
        description='Número da página (começa em 1).',
        ge=1,
    )

    limit: int | None = Field(
        default=50,
        description='Itens por página (máx. 100).',
        ge=1,
        le=100,
    )

    sort_by: Literal['symbol', 'expirationDate', 'underlyingAsset'] | None = Field(
        default='expirationDate',
        alias='sortBy',
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='asc',
        alias='sortOrder',
    )


class FutureQuotesQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Contratos separados por vírgula (máx. 20).',
        examples=['WINM26,BGIF27,DI1F27'],
    )


class FutureSpecsQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Contratos separados por vírgula (máx. 20).',
        examples=['WINM26,BGIF27,DI1F27'],
    )


class FutureHistoricalQuery(BrapiQuery):
    symbol: str = Field(
        default=...,
        description='Código do contrato (ex.: `WINM26`).',
        examples=['WINM26'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial (YYYY-MM-DD). Padrão: 12 meses atrás.',
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final (YYYY-MM-DD). Padrão: hoje.',
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
    )


class FutureTermStructureQuery(BrapiQuery):
    asset: str = Field(
        default=...,
        description='Código do ativo (ex.: `BGI`, `WIN`, `DI1`).',
        examples=['BGI'],
    )

    include_expired: Literal['true', 'false'] | None = Field(
        default='false',
        alias='includeExpired',
        description='`true` inclui contratos vencidos. Padrão: `false`.',
    )
