"""Query schemas for brapi FIIs endpoints."""

from typing import Literal

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class FiisListQuery(BrapiQuery):
    page: int | None = Field(
        default=1,
        description='Página (começa em 1)',
        examples=[1],
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        description='Itens por página (sem limite rígido; valores altos como 10000 são aceitos)',
        examples=[20],
        gt=0,
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
        description='Campo para ordenação',
        examples=['referenceDate'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )

    symbols: str | None = Field(
        default=None,
        description='Lista de símbolos de FIIs separados por vírgula. Máximo de 20 símbolos.',
        examples=['HGLG11,MXRF11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='Lista de CNPJs de FIIs separados por vírgula, com ou sem formatação. Máximo de 20 CNPJs.',
        examples=['11728688000147'],
    )

    search: str | None = Field(
        default=None,
        description='Buscar por nome, símbolo ou CNPJ',
        examples=['hglg'],
    )

    segment_type: Literal['papel', 'tijolo', 'hibrido', 'fof'] | None = Field(
        default=None,
        alias='segmentType',
        description='Tipo de segmento do indicador',
    )

    segmento_atuacao: str | None = Field(
        default=None,
        alias='segmentoAtuacao',
        description='Segmento de atuação (Logística, Shoppings, Escritórios, etc.)',
    )

    mandate: str | None = Field(
        default=None,
        description='Mandato (Renda, Híbrido, Títulos e Valores Mobiliários, etc.)',
    )

    tipo_gestao: str | None = Field(
        default=None,
        alias='tipoGestao',
        description='Tipo de gestão (Ativa, Definida)',
    )


class FiiIndicatorsQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos separados por vírgula (máximo 20). Exemplo: HGLG11,MXRF11',
        examples=['HGLG11,MXRF11'],
    )


class FiiIndicatorsHistoryQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos separados por vírgula (máximo 20). Exemplo: HGLG11,MXRF11',
        examples=['HGLG11,MXRF11'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data de início no formato YYYY-MM-DD',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data de fim no formato YYYY-MM-DD',
        examples=['2025-12-31'],
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
        description='Campo para ordenação',
        examples=['referenceDate'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )


class FiiHistoricalQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos separados por vírgula (máximo 20). Exemplo: HGLG11,MXRF11',
        examples=['HGLG11,MXRF11'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data de início no formato YYYY-MM-DD',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data de fim no formato YYYY-MM-DD',
        examples=['2025-12-31'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação por data',
        examples=['desc'],
    )


class FiiPortfolioQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos separados por vírgula (máximo 20). Exemplo: HGLG11,MXRF11',
        examples=['HGLG11,MXRF11'],
    )

    reference_date: str | None = Field(
        default=None,
        alias='referenceDate',
        description='Data de referência trimestral no formato YYYY-MM-DD. Se omitida, retorna o trimestre mais recente por FII.',
        examples=['2025-03-31'],
    )

    include: str | None = Field(
        default=None,
        description='Listas separadas por vírgula: allocations, properties, financialAssets, fundHoldings, lands, rights. summary sempre é retornado. Se omitido, retorna todas as listas.',
        examples=['allocations,fundHoldings'],
    )

    all_versions: Literal['true', 'false'] | None = Field(
        default='false',
        alias='allVersions',
        description='Incluir todas as versões do trimestre retornado (padrão: false, retorna apenas a mais recente)',
        examples=['false'],
    )


class FiiPropertiesQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos separados por vírgula (máximo 20). Exemplo: HGLG11,MXRF11',
        examples=['HGLG11,MXRF11'],
    )

    reference_date: str | None = Field(
        default=None,
        alias='referenceDate',
        description='Data de referência trimestral no formato YYYY-MM-DD. Se omitida, retorna o trimestre mais recente por FII.',
        examples=['2026-03-31'],
    )

    sort_by: Literal['revenueShare', 'area', 'vacancyRate', 'name'] | None = Field(
        default='revenueShare',
        alias='sortBy',
        description='Campo para ordenar os imóveis. Padrão: revenueShare.',
        examples=['revenueShare'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação dos imóveis.',
        examples=['desc'],
    )

    all_versions: Literal['true', 'false'] | None = Field(
        default='false',
        alias='allVersions',
        description='Incluir todas as versões do trimestre retornado (padrão: false, retorna apenas a mais recente)',
        examples=['false'],
    )


class FiiPropertiesHistoryQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos separados por vírgula (máximo 20). Exemplo: HGLG11,MXRF11',
        examples=['HGLG11,MXRF11'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data de início no formato YYYY-MM-DD',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data de fim no formato YYYY-MM-DD',
        examples=['2025-12-31'],
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
        description='Campo para ordenação',
        examples=['referenceDate'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )

    all_versions: Literal['true', 'false'] | None = Field(
        default='false',
        alias='allVersions',
        description='Incluir todas as versões de cada trimestre (padrão: false, retorna apenas a mais recente)',
        examples=['false'],
    )


class FiiPortfolioHistoryQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos separados por vírgula (máximo 20). Exemplo: HGLG11,MXRF11',
        examples=['HGLG11,MXRF11'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data de início no formato YYYY-MM-DD',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data de fim no formato YYYY-MM-DD',
        examples=['2025-12-31'],
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
        description='Campo para ordenação',
        examples=['referenceDate'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )

    all_versions: Literal['true', 'false'] | None = Field(
        default='false',
        alias='allVersions',
        description='Incluir todas as versões de cada trimestre (padrão: false, retorna apenas a mais recente)',
        examples=['false'],
    )


class FiiReportsQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos separados por vírgula (máximo 20). Exemplo: HGLG11,MXRF11',
        examples=['HGLG11,MXRF11'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data de início no formato YYYY-MM-DD',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data de fim no formato YYYY-MM-DD',
        examples=['2025-12-31'],
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
        description='Campo para ordenação',
        examples=['referenceDate'],
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
        description='Itens por página (sem limite rígido; valores altos como 10000 são aceitos)',
        examples=[20],
        gt=0,
    )

    all_versions: Literal['true', 'false'] | None = Field(
        default='false',
        alias='allVersions',
        description='Incluir todas as versões dos relatórios (padrão: false, retorna apenas a mais recente)',
        examples=['false'],
    )


class FiiDividendsQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Símbolos separados por vírgula (máximo 20). Exemplo: HGLG11,MXRF11',
        examples=['HGLG11,MXRF11'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data de início no formato YYYY-MM-DD',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data de fim no formato YYYY-MM-DD',
        examples=['2025-12-31'],
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
        description='Campo para ordenação',
        examples=['referenceDate'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )


class FiiFinancialsQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos de FIIs separados por vírgula (máximo 20)',
        examples=['HGLG11,MXRF11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['11728688000147'],
    )

    year: int | None = Field(
        default=None,
        description='Ano do documento',
        examples=[2025],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD',
        examples=['2025-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD',
        examples=['2025-12-31'],
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
        description='Campo de ordenação: referenceDate, symbol, cnpj, year',
        examples=['referenceDate'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
    )

    page: int | None = Field(
        default=1,
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        gt=0,
    )


class FiiAnnualReportsQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos de FIIs separados por vírgula (máximo 20)',
        examples=['HGLG11,MXRF11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['11728688000147'],
    )

    year: int | None = Field(
        default=None,
        description='Ano do documento',
        examples=[2025],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD',
        examples=['2025-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD',
        examples=['2025-12-31'],
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
        description='Campo de ordenação: referenceDate, symbol, cnpj, year',
        examples=['referenceDate'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
    )

    page: int | None = Field(
        default=1,
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        gt=0,
    )

    include: str | None = Field(
        default=None,
        description='Seções opcionais conforme estrutura do informe anual',
        examples=['summary,governance'],
    )
