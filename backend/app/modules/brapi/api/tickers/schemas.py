"""Query schemas for brapi Tickers endpoints."""

from typing import Literal

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class TickerRenamesQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Tickers separados por vírgula. Filtra renomes envolvendo qualquer ticker informado.',
        examples=['VVAR3,BHIA3'],
    )

    search: str | None = Field(
        default=None,
        description='Busca textual em ticker antigo, novo ou canônico',
        examples=['BHIA'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial do evento no formato YYYY-MM-DD',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final do evento no formato YYYY-MM-DD',
        examples=['2026-12-31'],
    )


class ResolveTickersQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula, máximo 20',
        examples=['VVAR3,PETR4'],
    )


class TickerCoverageQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula, máximo 20',
        examples=['PETR4,MXRF11,VVAR3'],
    )


class TickersQuery(BrapiQuery):
    search: str | None = Field(
        default=None,
        description='Busca textual por ticker, nome da empresa ou ticker antigo',
        examples=['PETR'],
    )

    sort_by: Literal['symbol', 'name', 'close', 'change', 'volume', 'marketCap'] | None = Field(
        default='volume',
        alias='sortBy',
        description='Campo para ordenação',
        examples=['volume'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )

    page: int | None = Field(
        default=1,
        description='Página (começa em 1)',
        examples=[1],
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        description='Itens por página. Máximo de 2000.',
        examples=[20],
        gt=0,
    )

    sector: str | None = Field(
        default=None,
        description='Filtra por setor',
        examples=['Finance'],
    )

    subsector: str | None = Field(
        default=None,
        description='Filtra pelo subsetor B3',
        examples=['Comércio'],
    )

    type: Literal['stock', 'fund', 'bdr'] | None = Field(
        default=None,
        description='Filtra por tipo amplo do ativo',
        examples=['stock'],
    )

    sub_type: Literal['stock', 'unit', 'fii', 'etf', 'fi-infra', 'fi-agro', 'fip', 'fidc', 'bdr'] | None = Field(
        default=None,
        alias='subType',
        description='Filtra por subtipo: stock, unit, fii, etf, fi-infra, fi-agro, fip, fidc ou bdr',
        examples=['fii'],
    )
