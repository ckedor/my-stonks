"""Query schemas for brapi Ações endpoints."""

from typing import Literal

from app.modules.brapi.api.schemas import BrapiQuery
from pydantic import Field


class StockQuotesQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula. Ex.: PETR4,VALE3. Tickers antigos são resolvidos para o ticker atual quando houver renome conhecido.',
        examples=['PETR4,VALE3'],
    )


class StockHistoricalQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula. Ex.: PETR4,VALE3. Tickers antigos são resolvidos para o ticker atual quando houver renome conhecido.',
        examples=['PETR4,VALE3'],
    )

    range: Literal['1d', '2d', '5d', '7d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'] | None = Field(
        default=None,
        description='Janela histórica. Padrão: 1mo.',
        examples=['1y'],
    )

    interval: Literal['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h', '1d', '5d', '1wk', '1mo', '3mo'] | None = Field(
        default=None,
        description='Granularidade da série. Padrão: 1d.',
        examples=['1d'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD.',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD.',
        examples=['2024-12-31'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Ordenação dos pontos históricos por data.',
        examples=['desc'],
    )


class StockDividendsQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula. Ex.: PETR4,VALE3. Tickers antigos são resolvidos para o ticker atual quando houver renome conhecido.',
        examples=['PETR4,VALE3'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD. Filtra por paymentDate/ex-date.',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD. Filtra por paymentDate/ex-date.',
        examples=['2024-12-31'],
    )

    sort_by: Literal['paymentDate', 'lastDatePrior', 'approvedOn', 'rate'] | None = Field(
        default='paymentDate',
        alias='sortBy',
        description='Campo usado para ordenar eventos.',
        examples=['paymentDate'],
    )

    sort_order: Literal['asc', 'desc'] | None = Field(
        default='desc',
        alias='sortOrder',
        description='Ordenação dos eventos.',
        examples=['desc'],
    )


class StockProfileQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula. Ex.: PETR4,VALE3. Tickers antigos são resolvidos para o ticker atual quando houver renome conhecido.',
        examples=['PETR4,VALE3'],
    )


class StockStatisticsQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula. Ex.: PETR4,VALE3. Tickers antigos são resolvidos para o ticker atual quando houver renome conhecido.',
        examples=['PETR4,VALE3'],
    )

    period: Literal['annual', 'quarterly'] | None = Field(
        default='annual',
        description='Período dos dados históricos.',
        examples=['annual'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-12-31'],
    )

    mode: Literal['current', 'history'] | None = Field(
        default='current',
        description='`current` retorna o indicador atual/TTM; `history` retorna a série anual ou trimestral.',
        examples=['current'],
    )


class StockFinancialDataQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula. Ex.: PETR4,VALE3. Tickers antigos são resolvidos para o ticker atual quando houver renome conhecido.',
        examples=['PETR4,VALE3'],
    )

    period: Literal['annual', 'quarterly'] | None = Field(
        default='annual',
        description='Período dos dados históricos.',
        examples=['annual'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-12-31'],
    )

    mode: Literal['current', 'history'] | None = Field(
        default='current',
        description='`current` retorna o indicador atual/TTM; `history` retorna a série anual ou trimestral.',
        examples=['current'],
    )


class StockBalanceSheetQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula. Ex.: PETR4,VALE3. Tickers antigos são resolvidos para o ticker atual quando houver renome conhecido.',
        examples=['PETR4,VALE3'],
    )

    period: Literal['annual', 'quarterly'] | None = Field(
        default='annual',
        description='Período dos dados históricos.',
        examples=['annual'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-12-31'],
    )


class StockIncomeStatementQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula. Ex.: PETR4,VALE3. Tickers antigos são resolvidos para o ticker atual quando houver renome conhecido.',
        examples=['PETR4,VALE3'],
    )

    period: Literal['annual', 'quarterly'] | None = Field(
        default='annual',
        description='Período dos dados históricos.',
        examples=['annual'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-12-31'],
    )


class StockCashFlowQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula. Ex.: PETR4,VALE3. Tickers antigos são resolvidos para o ticker atual quando houver renome conhecido.',
        examples=['PETR4,VALE3'],
    )

    period: Literal['annual', 'quarterly'] | None = Field(
        default='annual',
        description='Período dos dados históricos.',
        examples=['annual'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-12-31'],
    )


class StockValueAddedQuery(BrapiQuery):
    symbols: str = Field(
        default=...,
        description='Tickers separados por vírgula. Ex.: PETR4,VALE3. Tickers antigos são resolvidos para o ticker atual quando houver renome conhecido.',
        examples=['PETR4,VALE3'],
    )

    period: Literal['annual', 'quarterly'] | None = Field(
        default='annual',
        description='Período dos dados históricos.',
        examples=['annual'],
    )

    start_date: str | None = Field(
        default=None,
        alias='startDate',
        description='Data inicial em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-01-01'],
    )

    end_date: str | None = Field(
        default=None,
        alias='endDate',
        description='Data final em YYYY-MM-DD. Filtra linhas por date/endDate.',
        examples=['2024-12-31'],
    )
