"""Routes for brapi Ações endpoints."""

from typing import Annotated

from app.modules.brapi.api.stocks.schemas import (
    StockQuotesQuery,
    StockHistoricalQuery,
    StockDividendsQuery,
    StockProfileQuery,
    StockStatisticsQuery,
    StockFinancialDataQuery,
    StockBalanceSheetQuery,
    StockIncomeStatementQuery,
    StockCashFlowQuery,
    StockValueAddedQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/stocks', tags=['Ações'])


@router.get(
    '/quote',
    summary='Cotações v2 de ações',
    description='Retorna apenas o snapshot de cotação para um ou mais tickers B3. Use este endpoint quando você precisa de preço, variação, volume, market cap, faixa do dia, faixa de 52 semanas e logo, sem carregar módulos financeiros, histórico ou dividendos do endpoint legado `/api/quote/{tickers}`. Este é o primeiro endpoint composável de ações em `/api/v2/stocks/*`. Para descobrir tickers válidos, use `/api/v2/tickers`; para resolver tickers antigos, use `/api/v2/tickers/resolve`.\n\nExemplo: `GET /brapi/v2/stocks/quote?symbols=PETR4,VALE3`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_stock_quotes(
    query: Annotated[StockQuotesQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_stock_quotes(
        symbols=query.symbols,
    )


@router.get(
    '/historical',
    summary='Histórico v2 de ações',
    description='Retorna séries históricas OHLCV para um ou mais tickers B3. Use este endpoint quando você precisa apenas de preços históricos. Para snapshot de cotação, use `/api/v2/stocks/quote`; para descobrir tickers, use `/api/v2/tickers`. O endpoint aceita `range`/`interval` ou `startDate`/`endDate` e respeita os mesmos limites de plano do comportamento histórico legado em `/api/quote/{tickers}`.\n\nExemplo: `GET /brapi/v2/stocks/historical?symbols=PETR4,VALE3&range=1y&interval=1d`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_stock_historical(
    query: Annotated[StockHistoricalQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_stock_historical(
        symbols=query.symbols,
        range=query.range,
        interval=query.interval,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_order=query.sort_order,
    )


@router.get(
    '/dividends',
    summary='Dividendos v2 de ações',
    description='Retorna dividendos, JCP e eventos de ações para tickers B3 stock-like. Este endpoint substitui o uso de `/api/quote/{tickers}?dividends=true` para novas integrações que precisam apenas de proventos de ações. Para rendimentos de FIIs, use `/api/v2/fii/dividends`, que possui uma fonte e semântica específicas para FIIs.\n\nExemplo: `GET /brapi/v2/stocks/dividends?symbols=PETR4,VALE3&startDate=2024-01-01&endDate=2024-12-31`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_stock_dividends(
    query: Annotated[StockDividendsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_stock_dividends(
        symbols=query.symbols,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


@router.get(
    '/profile',
    summary='Perfil v2 de ações',
    description='Retorna o perfil cadastral/empresarial do ticker via o módulo legado summaryProfile.\n\nExemplo: `GET /brapi/v2/stocks/profile?symbols=PETR4,VALE3`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_stock_profile(
    query: Annotated[StockProfileQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_stock_profile(
        symbols=query.symbols,
    )


@router.get(
    '/statistics',
    summary='Estatísticas v2 de ações',
    description='Retorna indicadores estatísticos atuais ou históricos. Use mode=history e period=annual|quarterly para séries; startDate/endDate filtram as linhas históricas por date/endDate.\n\nExemplo: `GET /brapi/v2/stocks/statistics?symbols=PETR4,VALE3&period=annual&startDate=2024-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_stock_statistics(
    query: Annotated[StockStatisticsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_stock_statistics(
        symbols=query.symbols,
        period=query.period,
        start_date=query.start_date,
        end_date=query.end_date,
        mode=query.mode,
    )


@router.get(
    '/financial-data',
    summary='Dados financeiros v2 de ações',
    description='Retorna dados financeiros atuais/TTM ou históricos. Use mode=history e period=annual|quarterly para séries; startDate/endDate filtram as linhas históricas por date/endDate.\n\nExemplo: `GET /brapi/v2/stocks/financial-data?symbols=PETR4,VALE3&period=annual&startDate=2024-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_stock_financial_data(
    query: Annotated[StockFinancialDataQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_stock_financial_data(
        symbols=query.symbols,
        period=query.period,
        start_date=query.start_date,
        end_date=query.end_date,
        mode=query.mode,
    )


@router.get(
    '/balance-sheet',
    summary='Balanço patrimonial v2',
    description='Retorna histórico anual ou trimestral de balanço patrimonial. Use period=quarterly para dados trimestrais; startDate/endDate filtram por endDate.\n\nExemplo: `GET /brapi/v2/stocks/balance-sheet?symbols=PETR4,VALE3&period=annual&startDate=2024-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_stock_balance_sheet(
    query: Annotated[StockBalanceSheetQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_stock_balance_sheet(
        symbols=query.symbols,
        period=query.period,
        start_date=query.start_date,
        end_date=query.end_date,
    )


@router.get(
    '/income-statement',
    summary='DRE v2',
    description='Retorna histórico anual ou trimestral de demonstração de resultado. Use period=quarterly para dados trimestrais; startDate/endDate filtram por endDate.\n\nExemplo: `GET /brapi/v2/stocks/income-statement?symbols=PETR4,VALE3&period=annual&startDate=2024-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_stock_income_statement(
    query: Annotated[StockIncomeStatementQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_stock_income_statement(
        symbols=query.symbols,
        period=query.period,
        start_date=query.start_date,
        end_date=query.end_date,
    )


@router.get(
    '/cash-flow',
    summary='Fluxo de caixa v2',
    description='Retorna histórico anual ou trimestral de fluxo de caixa. Use period=quarterly para dados trimestrais; startDate/endDate filtram por endDate.\n\nExemplo: `GET /brapi/v2/stocks/cash-flow?symbols=PETR4,VALE3&period=annual&startDate=2024-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_stock_cash_flow(
    query: Annotated[StockCashFlowQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_stock_cash_flow(
        symbols=query.symbols,
        period=query.period,
        start_date=query.start_date,
        end_date=query.end_date,
    )


@router.get(
    '/value-added',
    summary='DVA v2',
    description='Retorna histórico anual ou trimestral de demonstração de valor adicionado. Use period=quarterly para dados trimestrais; startDate/endDate filtram por endDate.\n\nExemplo: `GET /brapi/v2/stocks/value-added?symbols=PETR4,VALE3&period=annual&startDate=2024-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_stock_value_added(
    query: Annotated[StockValueAddedQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_stock_value_added(
        symbols=query.symbols,
        period=query.period,
        start_date=query.start_date,
        end_date=query.end_date,
    )
