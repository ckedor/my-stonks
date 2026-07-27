"""Routes for brapi Fundos endpoints."""

from typing import Annotated

from app.modules.brapi.api.funds.schemas import (
    FundsListQuery,
    FundIndicatorsQuery,
    FundNavHistoryQuery,
    FundProfileQuery,
    FundDividendsQuery,
    FiagroReportsQuery,
    FiagroPortfolioQuery,
    FundPortfolioQuery,
    FidcReportsQuery,
    FidcPortfolioQuery,
    FipReportsQuery,
)
from app.modules.brapi.service import BrapiService, get_brapi_service
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/funds', tags=['Fundos'])


@router.get(
    '/list',
    summary='Lista fundos brasileiros por símbolo, CNPJ, busca e tipo',
    description='Descobre FIIs, FIAGROs, FI-Infra/FIFs, FIDCs, FIPs e outros fundos a partir da identidade canônica de fundos.\n\nExemplo: `GET /brapi/v2/funds/list?symbols=JURO11&cnpjs=42730834000100&page=1`',
    response_description='Resposta original retornada pela brapi.',
)
async def list_funds(
    query: Annotated[FundsListQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.list_funds(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        page=query.page,
        limit=query.limit,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        search=query.search,
        asset_type=query.asset_type,
        status=query.status,
    )


@router.get(
    '/indicators',
    summary='Indicadores atuais de fundos',
    description='Retorna indicadores atuais para fundos específicos. Use `/api/v2/funds/list` para descobrir fundos antes de consultar indicadores.\n\nExemplo: `GET /brapi/v2/funds/indicators?symbols=JURO11&cnpjs=42730834000100`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fund_indicators(
    query: Annotated[FundIndicatorsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fund_indicators(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        asset_type=query.asset_type,
    )


@router.get(
    '/nav/history',
    summary='Histórico do valor patrimonial por cota',
    description='Retorna a série do valor patrimonial por cota para fundos. FI/FIF usam informes diários; FIDCs usam informes mensais por classe ou série, incluindo a rentabilidade mensal oficial.\n\nExemplo: `GET /brapi/v2/funds/nav/history?symbols=JURO11&cnpjs=42730834000100&startDate=2026-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fund_nav_history(
    query: Annotated[FundNavHistoryQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fund_nav_history(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        start_date=query.start_date,
        end_date=query.end_date,
        page=query.page,
        limit=query.limit,
        sort_order=query.sort_order,
    )


@router.get(
    '/profile',
    summary='Perfil mensal CVM FI/FIF',
    description='Retorna perfil mensal de investidores, risco, liquidez, concentração e crédito privado.\n\nExemplo: `GET /brapi/v2/funds/profile?symbols=JURO11&cnpjs=42730834000100&startDate=2026-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fund_profile(
    query: Annotated[FundProfileQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fund_profile(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        start_date=query.start_date,
        end_date=query.end_date,
        reference_date=query.reference_date,
        include=query.include,
    )


@router.get(
    '/dividends',
    summary='Dividendos oficiais de fundos listados não-FII',
    description='Retorna eventos exatos de dividendos/rendimentos para FIAGRO, FI-Infra/FIF, FIDC e FIP listados quando a fonte oficial fornece data de declaração, data-com/ex, data de pagamento, valor por cota e rótulo. Os filtros startDate/endDate usam a data de pagamento (`paymentDate`). FIIs continuam no endpoint dedicado `/api/v2/fii/dividends`. Este endpoint não inventa datas a partir de relatórios mensais e não expõe metadados internos de fonte.\n\nExemplo: `GET /brapi/v2/funds/dividends?symbols=JURO11&cnpjs=42730834000100&startDate=2026-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fund_dividends(
    query: Annotated[FundDividendsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fund_dividends(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        start_date=query.start_date,
        end_date=query.end_date,
        page=query.page,
        limit=query.limit,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        asset_type=query.asset_type,
    )


@router.get(
    '/fiagro/reports',
    summary='Relatórios mensais FIAGRO',
    description='Retorna relatórios mensais FIAGRO com patrimônio, cotistas, rentabilidade e valores a distribuir.\n\nExemplo: `GET /brapi/v2/funds/fiagro/reports?symbols=XPCA11&cnpjs=41269527000101&startDate=2026-01-01`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fiagro_reports(
    query: Annotated[FiagroReportsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fiagro_reports(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        start_date=query.start_date,
        end_date=query.end_date,
        page=query.page,
        limit=query.limit,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        all_versions=query.all_versions,
    )


@router.get(
    '/fiagro/portfolio',
    summary='Carteira e alocação FIAGRO',
    description='Retorna resumo de patrimônio, alocações, investidores e passivos do FIAGRO.\n\nExemplo: `GET /brapi/v2/funds/fiagro/portfolio?symbols=XPCA11&cnpjs=41269527000101`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fiagro_portfolio(
    query: Annotated[FiagroPortfolioQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fiagro_portfolio(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        reference_date=query.reference_date,
        all_versions=query.all_versions,
        include=query.include,
    )


@router.get(
    '/portfolio',
    summary='Carteira oficial CVM CDA para fundos FI/FIF',
    description='Retorna carteira oficial CVM CDA agrupada por títulos públicos, cotas de fundos, crédito privado, recebíveis e valores a pagar.\n\nExemplo: `GET /brapi/v2/funds/portfolio?symbols=JURO11&cnpjs=42730834000100&page=1`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fund_portfolio(
    query: Annotated[FundPortfolioQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fund_portfolio(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        page=query.page,
        limit=query.limit,
        reference_date=query.reference_date,
        include=query.include,
    )


@router.get(
    '/fidc/reports',
    summary='Relatórios mensais FIDC',
    description='Retorna relatórios mensais FIDC com ativos, carteira, patrimônio líquido, classe e condomínio.\n\nExemplo: `GET /brapi/v2/funds/fidc/reports?cnpjs=05754060000113&startDate=2026-01-01&endDate=2026-06-30`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fidc_reports(
    query: Annotated[FidcReportsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fidc_reports(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        start_date=query.start_date,
        end_date=query.end_date,
        page=query.page,
        limit=query.limit,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


@router.get(
    '/fidc/portfolio',
    summary='Carteira, risco e cotistas FIDC',
    description='Retorna carteira, vencimentos, inadimplência, risco, cotistas e cedentes do FIDC.\n\nExemplo: `GET /brapi/v2/funds/fidc/portfolio?cnpjs=05754060000113`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fidc_portfolio(
    query: Annotated[FidcPortfolioQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fidc_portfolio(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        reference_date=query.reference_date,
        include=query.include,
    )


@router.get(
    '/fip/reports',
    summary='Relatórios estruturados FIP',
    description='Retorna relatórios trimestrais e quadrimestrais FIP com patrimônio, capital, cotas e composição de investidores em campos normalizados.\n\nExemplo: `GET /brapi/v2/funds/fip/reports?cnpjs=06033235000166&startDate=2026-01-01&endDate=2026-06-30`',
    response_description='Resposta original retornada pela brapi.',
)
async def get_fip_reports(
    query: Annotated[FipReportsQuery, Query()],
    service: BrapiService = Depends(get_brapi_service),
):
    return await service.get_fip_reports(
        symbols=query.symbols,
        cnpjs=query.cnpjs,
        start_date=query.start_date,
        end_date=query.end_date,
        page=query.page,
        limit=query.limit,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
        report_type=query.report_type,
    )
