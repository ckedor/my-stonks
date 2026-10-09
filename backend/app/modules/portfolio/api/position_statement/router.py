from fastapi import APIRouter, Depends, File, UploadFile

from app.composition.portfolio import get_position_statement_service
from app.modules.portfolio.api.access import OwnedFormPortfolioId, PortfolioGuard
from app.modules.portfolio.service.position_statement_service import PositionStatementService

from .schema import (
    PositionComparisonRequest,
    PositionDiffResponse,
    PositionStatementDraftResponse,
)

router = APIRouter(prefix='/position_statement', tags=['Portfolio Position Statement'])


@router.post('/extraction', response_model=PositionStatementDraftResponse)
async def extract_position_statement(
    portfolio_id: OwnedFormPortfolioId,
    file: UploadFile = File(..., description='Extrato de posição da corretora, em PDF'),
    service: PositionStatementService = Depends(get_position_statement_service),
):
    """Read a broker statement and compare its holdings with the portfolio. Writes nothing."""
    content = await file.read()
    return await service.extract(
        portfolio_id=portfolio_id,
        filename=file.filename or 'extrato.pdf',
        content=content,
    )


@router.post('/comparison', response_model=list[PositionDiffResponse])
async def compare_position_statement(
    request: PositionComparisonRequest,
    guard: PortfolioGuard,
    service: PositionStatementService = Depends(get_position_statement_service),
):
    """Compare reviewed holdings with the portfolio again, without reading the PDF again."""
    await guard(portfolios=[request.portfolio_id])
    return await service.compare(
        portfolio_id=request.portfolio_id,
        broker_id=request.broker_id,
        as_of=request.as_of,
        holdings=[holding.to_domain() for holding in request.holdings],
    )
