"""Query schemas for brapi Tesouro Direto endpoints."""

from typing import Literal

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class TreasuryListQuery(BrapiQuery):
    page: int | None = Field(
        default=1,
        description='Página (começa em 1)',
        examples=[1],
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        description='Itens por página',
        examples=[20],
        gt=0,
    )

    search: str | None = Field(
        default=None,
        description='Busca por símbolo público do Tesouro Direto ou nome do título. Exemplo: tesouro-selic-01032031',
        examples=['tesouro-selic-01032031'],
    )

    indexer: Literal['selic', 'prefixado', 'ipca', 'igpm'] | None = Field(
        default=None,
        description='Filtra pelo indexador do título',
        examples=['selic'],
    )

    coupon_type: Literal['zero', 'semestral'] | None = Field(
        default=None,
        alias='couponType',
        description='Filtra pelo tipo de cupom',
        examples=['zero'],
    )

    sort_by: Literal['symbol', 'bondType', 'maturityDate', 'durationDays', 'baseDate', 'buyRate', 'sellRate', 'buyPrice', 'sellPrice', 'basePrice'] | None = Field(
        default='maturityDate',
        alias='sortBy',
        description='Campo para ordenação',
        examples=['maturityDate'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='asc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['asc'],
    )


class TreasuryIndicatorsQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos do Tesouro Direto separados por vírgula (máximo 20). Exemplo: tesouro-selic-01032031,tesouro-ipca-15052035',
        examples=['tesouro-selic-01032031,tesouro-ipca-15052035'],
    )


class TreasuryIndicatorsHistoryQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos do Tesouro Direto separados por vírgula (máximo 20). Exemplo: tesouro-selic-01032031,tesouro-ipca-15052035',
        examples=['tesouro-selic-01032031,tesouro-ipca-15052035'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data de início no formato YYYY-MM-DD',
        examples=['2025-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data de fim no formato YYYY-MM-DD',
        examples=['2026-05-15'],
    )

    sort_by: Literal['baseDate', 'buyRate', 'sellRate', 'buyPrice', 'sellPrice', 'basePrice'] | None = Field(
        default='baseDate',
        alias='sortBy',
        description='Campo para ordenação dentro da série histórica',
        examples=['baseDate'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )
