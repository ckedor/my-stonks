"""Query schemas for brapi Macroeconomia endpoints."""

from typing import Literal

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class MacroAvailableQuery(BrapiQuery):
    q: str | None = Field(
        default=None,
        description='Filtro textual aplicado a slug, alias, nome e descrição (case-insensitive, substring). Quando informado, os resultados vêm ordenados por relevância.',
        examples=['juros'],
        min_length=1,
    )

    category: str | None = Field(
        default=None,
        description='Filtrar por categoria (ex: `interestRate`, `inflation`).',
        examples=['interestRate'],
    )


class MacroSeriesQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Slugs separados por vírgula (máx. 20). Slugs disponíveis — interestRate: `selic`, `selicovernight`, `cdi`, `tr`; inflation: `ipca`, `ipca12m`, `inpc`, `igpm`, `igpdi`; activity: `ibcbr`, `pibmensal`; labor: `desemprego`; monetary: `m1`, `m4`; external: `reservas`. Veja `/api/v2/macro/available` para metadados completos (unidade, frequência, descrição) e busca por texto.',
        examples=['selic,ipca'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial (YYYY-MM-DD). Padrão: 12 meses atrás.',
        examples=['2025-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final (YYYY-MM-DD). Padrão: hoje.',
        examples=['2026-04-30'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Ordenação por data.',
        examples=['desc'],
    )

    limit: int | None = Field(
        default=None,
        description='Máximo de observações por série (padrão 20). Sem teto — passe `limit=10000` para histórico completo.',
        examples=[20],
        gt=0,
    )


class MacroLatestQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Slugs separados por vírgula. Omitir retorna o último valor de TODAS as séries disponíveis. Slugs: selic, selicovernight, cdi, tr, ipca, ipca12m, inpc, igpm, igpdi, ibcbr, pibmensal, desemprego, m1, m4, reservas. Veja `/api/v2/macro/available` para metadados.',
        examples=['selic,cdi,ipca'],
    )
