"""Query schemas for brapi Opções endpoints."""

from typing import Literal

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class OptionExpirationsQuery(BrapiQuery):
    underlying: str = Field(
        default=...,
        description='Código do ativo subjacente (ação, ETF ou índice) das opções que você quer listar.',
        examples=['PETR4'],
    )

    include_expired: Literal['true', 'false'] | None = Field(
        default='false',
        alias='includeExpired',
        description='Se `true`, inclui vencimentos já passados. Padrão `false` retorna apenas vencimentos futuros.',
    )


class OptionStrikesQuery(BrapiQuery):
    underlying: str = Field(
        default=...,
        description='Código do ativo subjacente (ação, ETF ou índice) das opções que você quer listar.',
        examples=['PETR4'],
    )

    expiration_date: str = Field(
        default=...,
        alias='expirationDate',
        description='Data de vencimento das opções, no formato YYYY-MM-DD. Use `/expirations` para descobrir os vencimentos disponíveis.',
        examples=['2026-12-18'],
    )

    side: Literal['call', 'put'] | None = Field(
        default=None,
        description='Filtra por tipo da opção: `call` (compra) ou `put` (venda). Omita para retornar ambos.',
    )


class OptionChainQuery(BrapiQuery):
    underlying: str = Field(
        default=...,
        description='Código do ativo subjacente (ação, ETF ou índice) das opções que você quer listar.',
        examples=['PETR4'],
    )

    expiration_date: str = Field(
        default=...,
        alias='expirationDate',
        description='Data de vencimento das opções, no formato YYYY-MM-DD. Use `/expirations` para descobrir os vencimentos disponíveis.',
        examples=['2026-12-18'],
    )

    date: str | None = Field(
        default=None,
        description='Data EOD usada para buscar preço e volume do dia, no formato YYYY-MM-DD. Padrão: último pregão disponível.',
        examples=['2026-06-01'],
    )

    side: Literal['call', 'put'] | None = Field(
        default=None,
        description='Filtra por tipo da opção: `call` (compra) ou `put` (venda). Omita para retornar ambos.',
    )

    min_strike: float | None = Field(
        default=None,
        alias='minStrike',
        description='Strike mínimo a considerar. Útil para limitar a resposta a uma faixa de preços de exercício.',
    )

    max_strike: float | None = Field(
        default=None,
        alias='maxStrike',
        description='Strike máximo a considerar. Útil para limitar a resposta a uma faixa de preços de exercício.',
    )


class OptionHistoricalQuery(BrapiQuery):
    symbol: str = Field(
        default=...,
        description='Símbolo da opção',
        examples=['PETRF783'],
    )

    expiration_date: str = Field(
        default=...,
        alias='expirationDate',
        description='Data de vencimento no formato YYYY-MM-DD',
        examples=['2026-12-18'],
    )

    strike: float | None = Field(
        default=None,
        description='Preço de exercício. Use quando o mesmo símbolo aparecer mais de uma vez no mesmo vencimento.',
        examples=[7.29],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data de início no formato YYYY-MM-DD (padrão: 12 meses)',
        examples=['2026-05-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data de fim no formato YYYY-MM-DD',
        examples=['2026-06-01'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Ordem dos pontos em `history` por data: `asc` do mais antigo ao mais recente, `desc` do mais recente ao mais antigo. Padrão `desc`.',
    )


class OptionAnalyticsQuery(BrapiQuery):
    underlying: str = Field(
        default=...,
        description='Código do ativo subjacente (ação, ETF ou índice) das opções que você quer listar.',
        examples=['PETR4'],
    )

    expiration_date: str = Field(
        default=...,
        alias='expirationDate',
        description='Data de vencimento das opções, no formato YYYY-MM-DD. Use `/expirations` para descobrir os vencimentos disponíveis.',
        examples=['2026-12-18'],
    )

    date: str | None = Field(
        default=None,
        description='Data EOD usada para buscar preço e volume do dia, no formato YYYY-MM-DD. Padrão: último pregão disponível.',
        examples=['2026-06-01'],
    )

    side: Literal['call', 'put'] | None = Field(
        default=None,
        description='Filtra por tipo da opção: `call` (compra) ou `put` (venda). Omita para retornar ambos.',
    )

    min_strike: float | None = Field(
        default=None,
        alias='minStrike',
        description='Strike mínimo a considerar. Útil para limitar a resposta a uma faixa de preços de exercício.',
    )

    max_strike: float | None = Field(
        default=None,
        alias='maxStrike',
        description='Strike máximo a considerar. Útil para limitar a resposta a uma faixa de preços de exercício.',
    )

    limit: int | None = Field(
        default=None,
        description='Limita a quantidade de séries retornadas na cadeia analítica. Padrão: todas as séries do filtro.',
        examples=[50],
        ge=1,
        le=500,
    )


class OptionAnalyticsHistoryQuery(BrapiQuery):
    symbol: str = Field(
        default=...,
        description='Símbolo da opção',
        examples=['PETRF783'],
    )

    expiration_date: str = Field(
        default=...,
        alias='expirationDate',
        description='Data de vencimento no formato YYYY-MM-DD',
        examples=['2026-12-18'],
    )

    strike: float | None = Field(
        default=None,
        description='Preço de exercício. Use quando o mesmo símbolo aparecer mais de uma vez no mesmo vencimento.',
        examples=[7.29],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data de início no formato YYYY-MM-DD (padrão: 12 meses)',
        examples=['2026-05-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data de fim no formato YYYY-MM-DD',
        examples=['2026-06-01'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Ordem dos pontos em `history` por data: `asc` do mais antigo ao mais recente, `desc` do mais recente ao mais antigo. Padrão `desc`.',
    )
