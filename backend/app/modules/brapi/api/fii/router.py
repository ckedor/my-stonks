"""Routes for brapi FIIs endpoints."""

from typing import Annotated

from app.modules.brapi.api.fii.schemas import (
    FiisListQuery,
    FiiIndicatorsQuery,
    FiiIndicatorsHistoryQuery,
    FiiHistoricalQuery,
    FiiPortfolioQuery,
    FiiPropertiesQuery,
    FiiPropertiesHistoryQuery,
    FiiPortfolioHistoryQuery,
    FiiReportsQuery,
    FiiDividendsQuery,
    FiiFinancialsQuery,
    FiiAnnualReportsQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/fii', tags=['FIIs'])


@router.get(
    '/list',
    summary='Listar Fundos Imobiliários',
    description='Retorna a lista paginada de todos os Fundos de Investimento Imobiliário (FIIs) registrados, com dados do instrumento e indicadores atuais. Ideal para descobrir novos FIIs, comparar rentabilidades e construir carteiras diversificadas.\n\nExemplo: `GET /brapi/v2/fii/list?page=1&limit=20&sortBy=referenceDate`',
    response_description='Resposta original retornada pela brapi.',
)
async def list_fiis(
    query: Annotated[FiisListQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.list_fiis(
        page=query.page,
        limit=query.limit,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        search=query.search,
        segment_type=query.segment_type,
        segmento_atuacao=query.segmento_atuacao,
        mandate=query.mandate,
        tipo_gestao=query.tipo_gestao,
    )


@router.get(
    '/indicators',
    summary='Obter Indicadores Fundamentalistas',
    description='Retorna os indicadores fundamentalistas mais recentes para um ou mais FIIs. Use este endpoint para análises de valuation, rentabilidade e comparações entre fundos.\n\nExemplo: `GET /brapi/v2/fii/indicators?symbols=HGLG11,MXRF11`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_indicators(
    query: Annotated[FiiIndicatorsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_indicators(
        symbols=query.symbols,
    )


@router.get(
    '/indicators/history',
    summary='Obter Histórico de Indicadores',
    description='Retorna a série temporal mensal dos indicadores fundamentalistas. Analise tendências de valuation, rentabilidade e crescimento patrimonial ao longo do tempo.\n\nExemplo: `GET /brapi/v2/fii/indicators/history?symbols=HGLG11,MXRF11&startDate=2024-01-01&endDate=2025-12-31`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_indicators_history(
    query: Annotated[FiiIndicatorsHistoryQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_indicators_history(
        symbols=query.symbols,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


@router.get(
    '/historical',
    summary='Obter Cotações Históricas (OHLCV)',
    description='Retorna a série histórica de preços OHLCV (Abertura, Máxima, Mínima, Fechamento, Volume) diários. Use para backtesting, análise técnica e construção de modelos de previsão.\n\nExemplo: `GET /brapi/v2/fii/historical?symbols=HGLG11,MXRF11&startDate=2024-01-01&endDate=2025-12-31`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_historical(
    query: Annotated[FiiHistoricalQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_historical(
        symbols=query.symbols,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_order=query.sort_order,
    )


@router.get(
    '/portfolio',
    summary='Obter Composição da Carteira',
    description='Retorna a composição normalizada da carteira dos FIIs a partir dos informes trimestrais da CVM. Use para entender o que um FII possui: CRIs, cotas de outros FIIs, imóveis, direitos e terrenos.\n\nExemplo: `GET /brapi/v2/fii/portfolio?symbols=HGLG11,MXRF11&referenceDate=2025-03-31&include=allocations,fundHoldings`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_portfolio(
    query: Annotated[FiiPortfolioQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_portfolio(
        symbols=query.symbols,
        reference_date=query.reference_date,
        include=query.include,
        all_versions=query.all_versions,
    )


@router.get(
    '/properties',
    summary='Obter Imóveis e Vacância',
    description='Retorna os imóveis físicos dos FIIs com vacância em primeiro plano. Use este endpoint para análise de FIIs de tijolo, galpões, lajes, shoppings e qualquer carteira imobiliária física.\n\nExemplo: `GET /brapi/v2/fii/properties?symbols=HGLG11,MXRF11&referenceDate=2026-03-31&sortBy=revenueShare`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_properties(
    query: Annotated[FiiPropertiesQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_properties(
        symbols=query.symbols,
        reference_date=query.reference_date,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        all_versions=query.all_versions,
    )


@router.get(
    '/properties/history',
    summary='Histórico de Imóveis e Vacância',
    description='Retorna a série trimestral compacta dos imóveis e da vacância dos FIIs. Use este endpoint para gráficos e comparações de vacância, área total e quantidade de imóveis ao longo do tempo.\n\nExemplo: `GET /brapi/v2/fii/properties/history?symbols=HGLG11,MXRF11&startDate=2024-01-01&endDate=2025-12-31`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_properties_history(
    query: Annotated[FiiPropertiesHistoryQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_properties_history(
        symbols=query.symbols,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        all_versions=query.all_versions,
    )


@router.get(
    '/portfolio/history',
    summary='Histórico da Carteira',
    description='Retorna a série trimestral compacta da composição da carteira dos FIIs. Use este endpoint para acompanhar evolução de alocação, valor declarado, quantidade de ativos, imóveis e exposição por classe ao longo do tempo.\n\nExemplo: `GET /brapi/v2/fii/portfolio/history?symbols=HGLG11,MXRF11&startDate=2024-01-01&endDate=2025-12-31`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_portfolio_history(
    query: Annotated[FiiPortfolioHistoryQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_portfolio_history(
        symbols=query.symbols,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        all_versions=query.all_versions,
    )


@router.get(
    '/reports',
    summary='Obter Relatórios Gerenciais',
    description='Retorna os relatórios gerenciais mensais publicados na CVM, com composição patrimonial detalhada. Analise a alocação de ativos, estrutura de passivos e evolução do patrimônio dos FIIs.\n\nExemplo: `GET /brapi/v2/fii/reports?symbols=HGLG11,MXRF11&startDate=2024-01-01&endDate=2025-12-31`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_reports(
    query: Annotated[FiiReportsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_reports(
        symbols=query.symbols,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        page=query.page,
        limit=query.limit,
        all_versions=query.all_versions,
    )


@router.get(
    '/dividends',
    summary='Obter Histórico de Proventos',
    description='Retorna o histórico de pagamentos de proventos (Rendimentos, Amortizações) dos FIIs. Analise a rentabilidade histórica e padrões de distribuição de cada fundo.\n\nExemplo: `GET /brapi/v2/fii/dividends?symbols=HGLG11,MXRF11&startDate=2024-01-01&endDate=2025-12-31`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_dividends(
    query: Annotated[FiiDividendsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_dividends(
        symbols=query.symbols,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


@router.get(
    '/financials',
    summary='Relatórios financeiros DFIN de FIIs',
    description='Consulta dados financeiros estruturados de FIIs provenientes dos documentos DFIN oficiais da CVM. Aceita símbolo ou CNPJ.\n\nExemplo: `GET /brapi/v2/fii/financials?symbols=HGLG11,MXRF11&cnpjs=11728688000147&year=2025`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_financials(
    query: Annotated[FiiFinancialsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_financials(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        year=query.year,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        page=query.page,
        limit=query.limit,
    )


@router.get(
    '/annual-reports',
    summary='Informes anuais de FIIs',
    description='Consulta informes anuais oficiais de FIIs da CVM. FIAGRO, FI-Infra, FIDC e FIP permanecem em endpoints próprios.\n\nExemplo: `GET /brapi/v2/fii/annual-reports?symbols=HGLG11,MXRF11&cnpjs=11728688000147&year=2025`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fii_annual_reports(
    query: Annotated[FiiAnnualReportsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fii_annual_reports(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        year=query.year,
        start_date=query.start_date,
        end_date=query.end_date,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        page=query.page,
        limit=query.limit,
        include=query.include,
    )
