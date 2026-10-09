from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.composition.portfolio import get_portfolio_income_tax_service
from app.modules.portfolio.service.portfolio_income_tax_service import (
    PortfolioIncomeTaxService,
)
from app.modules.users.domain import User
from app.modules.users.views import current_active_user

from .schemas import DarfPaymentRequest, DarfPaymentResponse, IncomeTaxAssessmentResponse

router = APIRouter(prefix='/income_tax', tags=['Income Tax'])


@router.get('/assessment', response_model=IncomeTaxAssessmentResponse)
async def get_assessment(
    fiscal_year: Annotated[int, Query(ge=2000, le=2100)],
    user: Annotated[User, Depends(current_active_user)],
    service: Annotated[PortfolioIncomeTaxService, Depends(get_portfolio_income_tax_service)],
):
    """The year's assessment over every portfolio of the user: months, DARFs, pendencies."""
    report = await service.get_assessment(user.id, fiscal_year)
    return IncomeTaxAssessmentResponse.from_report(report)


@router.get('/darf_payment', response_model=list[DarfPaymentResponse])
async def list_darf_payments(
    user: Annotated[User, Depends(current_active_user)],
    service: Annotated[PortfolioIncomeTaxService, Depends(get_portfolio_income_tax_service)],
):
    return await service.list_darf_payments(user.id)


@router.post('/darf_payment', response_model=DarfPaymentResponse, status_code=201)
async def register_darf_payment(
    payload: DarfPaymentRequest,
    user: Annotated[User, Depends(current_active_user)],
    service: Annotated[PortfolioIncomeTaxService, Depends(get_portfolio_income_tax_service)],
):
    """Record a paid DARF. Paying is a fact the application never infers from the tax."""
    return await service.register_darf_payment(user.id, **payload.model_dump())


@router.delete('/darf_payment/{payment_id}', status_code=204)
async def delete_darf_payment(
    payment_id: int,
    user: Annotated[User, Depends(current_active_user)],
    service: Annotated[PortfolioIncomeTaxService, Depends(get_portfolio_income_tax_service)],
):
    await service.delete_darf_payment(user.id, payment_id)
