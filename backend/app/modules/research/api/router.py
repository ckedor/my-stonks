from fastapi import APIRouter, Depends, File, UploadFile

from app.composition.research import (
    get_recommended_portfolio_extraction_service,
    get_recommended_portfolio_service,
)
from app.modules.research.api.schemas import (
    RecommendedPortfolioDraftResponse,
    RecommendedPortfolioResponse,
    ResearchSourceResponse,
    SaveRecommendedPortfolioRequest,
)
from app.modules.research.domain.commands import (
    SaveRecommendedPortfolioCommand,
    SaveRecommendedPositionCommand,
)
from app.modules.research.service.recommended_portfolio_extraction_service import (
    RecommendedPortfolioExtractionService,
)
from app.modules.research.service.recommended_portfolio_service import (
    RecommendedPortfolioService,
)
from app.modules.users.views import current_active_user, current_superuser

router = APIRouter(tags=['Research'], prefix='/research')

recommended_portfolio_router = APIRouter(prefix='/recommended_portfolio')


@router.get('/source', response_model=list[ResearchSourceResponse])
async def list_sources(
    _: object = Depends(current_active_user),
    service: RecommendedPortfolioService = Depends(get_recommended_portfolio_service),
):
    return await service.list_sources()


@recommended_portfolio_router.post(
    '/extraction',
    response_model=RecommendedPortfolioDraftResponse,
    dependencies=[Depends(current_superuser)],
)
async def extract_recommended_portfolio(
    file: UploadFile = File(..., description='Relatório em PDF da carteira recomendada'),
    service: RecommendedPortfolioExtractionService = Depends(
        get_recommended_portfolio_extraction_service
    ),
):
    """Read a research PDF and line its tickers up against the catalogue.

    Nothing is persisted here. The answer is a draft for a person to look at,
    correct, and post back through `POST /research/recommended_portfolio`.
    """
    content = await file.read()
    return await service.extract(filename=file.filename or 'relatorio.pdf', content=content)


@recommended_portfolio_router.get('', response_model=list[RecommendedPortfolioResponse])
async def list_recommended_portfolios(
    _: object = Depends(current_active_user),
    service: RecommendedPortfolioService = Depends(get_recommended_portfolio_service),
):
    return await service.list()


@recommended_portfolio_router.get(
    '/{recommended_portfolio_id}', response_model=RecommendedPortfolioResponse
)
async def get_recommended_portfolio(
    recommended_portfolio_id: int,
    _: object = Depends(current_active_user),
    service: RecommendedPortfolioService = Depends(get_recommended_portfolio_service),
):
    return await service.get(recommended_portfolio_id)


@recommended_portfolio_router.post(
    '',
    response_model=RecommendedPortfolioResponse,
    dependencies=[Depends(current_superuser)],
)
async def create_recommended_portfolio(
    payload: SaveRecommendedPortfolioRequest,
    service: RecommendedPortfolioService = Depends(get_recommended_portfolio_service),
):
    command = SaveRecommendedPortfolioCommand(
        source_name=payload.source_name,
        title=payload.title,
        reference_date=payload.reference_date,
        summary=payload.summary,
        objective=payload.objective,
        positions=[
            SaveRecommendedPositionCommand(
                ticker=position.ticker,
                asset_id=position.asset_id,
                name=position.name,
                weight=position.weight,
                rationale=position.rationale,
                target_price=position.target_price,
                change=position.change,
            )
            for position in payload.positions
        ],
    )
    return await service.create(command)


@recommended_portfolio_router.delete(
    '/{recommended_portfolio_id}',
    dependencies=[Depends(current_superuser)],
)
async def delete_recommended_portfolio(
    recommended_portfolio_id: int,
    service: RecommendedPortfolioService = Depends(get_recommended_portfolio_service),
):
    await service.delete(recommended_portfolio_id)
    return {'message': 'Recommended portfolio deleted successfully.'}


router.include_router(recommended_portfolio_router)
