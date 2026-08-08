from app.infra.db.dependencies import get_portfolio_repository
from app.modules.portfolio.repositories import PortfolioRepository
from app.modules.portfolio.service.portfolio_income_tax_service import \
    PortfolioIncomeTaxService
from fastapi import APIRouter, Depends, Query

router = APIRouter(prefix='/income_tax', tags=['Income Tax'])


@router.get('/{portfolio_id}/assets_and_rights')
async def get_assets_and_rights(
    portfolio_id: int,
    fiscal_year: int = Query(...),
    repository: PortfolioRepository = Depends(get_portfolio_repository),
):
    service = PortfolioIncomeTaxService(repository)
    return await service.get_assets_and_rights(portfolio_id, fiscal_year)


@router.get('/{portfolio_id}/variable_income/fii_operation')
async def get_fiis_operations_tax(
    portfolio_id: int,
    fiscal_year: int = Query(...),
    repository: PortfolioRepository = Depends(get_portfolio_repository),
):
    service = PortfolioIncomeTaxService(repository)
    return await service.get_fiis_operations_tax(portfolio_id, fiscal_year)


@router.get('/{portfolio_id}/variable_income/common_operation')
async def get_common_operations_tax(
    portfolio_id: int,
    fiscal_year: int = Query(...),
    repository: PortfolioRepository = Depends(get_portfolio_repository),
):
    service = PortfolioIncomeTaxService(repository)
    return await service.get_common_operations_tax(portfolio_id, fiscal_year)


@router.get('/{portfolio_id}/darf')
async def get_darf(
    portfolio_id: int,
    fiscal_year: int = Query(...),
    repository: PortfolioRepository = Depends(get_portfolio_repository),
):
    service = PortfolioIncomeTaxService(repository)
    return await service.get_darf(portfolio_id, fiscal_year)
