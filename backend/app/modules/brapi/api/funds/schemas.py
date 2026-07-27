"""Query schemas for brapi Fundos endpoints."""

from typing import Literal

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class FundsListQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
        examples=['JURO11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['42730834000100'],
    )

    page: int | None = Field(
        default=1,
        description='Página (começa em 1)',
        examples=[1],
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        description='Itens por página (padrão 20). Sem limite rígido; valores altos são aceitos.',
        examples=[20],
        gt=0,
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )

    search: str | None = Field(
        default=None,
    )

    asset_type: Literal['fii', 'fiagro', 'fiinfra', 'fif', 'fidc', 'fip', 'etf', 'other'] | None = Field(
        default=None,
        alias='assetType',
    )

    status: str | None = Field(
        default=None,
    )


class FundIndicatorsQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
        examples=['JURO11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['42730834000100'],
    )

    asset_type: Literal['fii', 'fiagro', 'fiinfra', 'fif', 'fidc', 'fip', 'etf', 'other'] | None = Field(
        default=None,
        alias='assetType',
    )


class FundNavHistoryQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
        examples=['JURO11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['42730834000100'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD',
        examples=['2026-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD',
        examples=['2026-06-30'],
    )

    page: int | None = Field(
        default=1,
        description='Página (começa em 1)',
        examples=[1],
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        description='Itens por página (padrão 20). Sem limite rígido; valores altos são aceitos.',
        examples=[20],
        gt=0,
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )


class FundProfileQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
        examples=['JURO11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['42730834000100'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD',
        examples=['2026-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD',
        examples=['2026-06-30'],
    )

    reference_date: str | None = Field(
        default=None,
        alias='referenceDate',
    )

    include: str | None = Field(
        default=None,
    )


class FundDividendsQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
        examples=['JURO11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['42730834000100'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD',
        examples=['2026-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD',
        examples=['2026-06-30'],
    )

    page: int | None = Field(
        default=1,
        description='Página (começa em 1)',
        examples=[1],
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        description='Itens por página (padrão 20). Sem limite rígido; valores altos são aceitos.',
        examples=[20],
        gt=0,
    )

    sort_by: Literal['lastDatePrior', 'paymentDate', 'declaredDate', 'symbol', 'rate'] | None = Field(
        default='paymentDate',
        alias='sortBy',
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )

    asset_type: Literal['fiagro', 'fiinfra', 'fif', 'fidc', 'fip', 'other'] | None = Field(
        default=None,
        alias='assetType',
    )


class FiagroReportsQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
        examples=['XPCA11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['41269527000101'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD',
        examples=['2026-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD',
        examples=['2026-06-30'],
    )

    page: int | None = Field(
        default=1,
        description='Página (começa em 1)',
        examples=[1],
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        description='Itens por página (padrão 20). Sem limite rígido; valores altos são aceitos.',
        examples=[20],
        gt=0,
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )

    all_versions: bool | None = Field(
        default=False,
        alias='allVersions',
    )


class FiagroPortfolioQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
        examples=['XPCA11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['41269527000101'],
    )

    reference_date: str | None = Field(
        default=None,
        alias='referenceDate',
    )

    all_versions: bool | None = Field(
        default=False,
        alias='allVersions',
    )

    include: str | None = Field(
        default=None,
    )


class FundPortfolioQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
        examples=['JURO11'],
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['42730834000100'],
    )

    page: int | None = Field(
        default=1,
        description='Página (começa em 1)',
        examples=[1],
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        description='Itens por página (padrão 20). Sem limite rígido; valores altos são aceitos.',
        examples=[20],
        gt=0,
    )

    reference_date: str | None = Field(
        default=None,
        alias='referenceDate',
    )

    include: str | None = Field(
        default=None,
    )


class FidcReportsQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['05754060000113'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD',
        examples=['2026-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD',
        examples=['2026-06-30'],
    )

    page: int | None = Field(
        default=1,
        description='Página (começa em 1)',
        examples=[1],
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        description='Itens por página (padrão 20). Sem limite rígido; valores altos são aceitos.',
        examples=[20],
        gt=0,
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )


class FidcPortfolioQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['05754060000113'],
    )

    reference_date: str | None = Field(
        default=None,
        alias='referenceDate',
    )

    include: str | None = Field(
        default=None,
    )


class FipReportsQuery(BrapiQuery):
    symbols: str | None = Field(
        default=None,
        description='Símbolos B3 separados por vírgula (máximo 20)',
    )

    cnpjs: str | None = Field(
        default=None,
        description='CNPJs separados por vírgula, com ou sem formatação',
        examples=['06033235000166'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD',
        examples=['2026-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD',
        examples=['2026-06-30'],
    )

    page: int | None = Field(
        default=1,
        description='Página (começa em 1)',
        examples=[1],
        gt=0,
    )

    limit: int | None = Field(
        default=20,
        description='Itens por página (padrão 20). Sem limite rígido; valores altos são aceitos.',
        examples=[20],
        gt=0,
    )

    sort_by: str | None = Field(
        default=None,
        alias='sortBy',
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Direção da ordenação',
        examples=['desc'],
    )

    report_type: Literal['trimestral', 'quadrimestral'] | None = Field(
        default=None,
        alias='reportType',
    )
