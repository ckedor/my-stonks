from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, Response

from app.composition.portfolio import get_portfolio_document_service
from app.modules.portfolio.api.access import OwnedPortfolioId
from app.modules.portfolio.service.portfolio_document_service import PortfolioDocumentService

from .schema import PortfolioDocumentResponse

router = APIRouter(prefix='/document', tags=['Portfolio Document'])


@router.get('', response_model=list[PortfolioDocumentResponse])
async def list_documents(
    portfolio_id: OwnedPortfolioId,
    service: Annotated[PortfolioDocumentService, Depends(get_portfolio_document_service)],
):
    """Files uploaded to the portfolio and kept, newest first."""
    return await service.list_documents(portfolio_id)


@router.get('/{document_id}/content', response_class=Response)
async def read_document_content(
    document_id: int,
    portfolio_id: OwnedPortfolioId,
    service: Annotated[PortfolioDocumentService, Depends(get_portfolio_document_service)],
):
    """The file itself, as it was uploaded."""
    document = await service.read(portfolio_id=portfolio_id, document_id=document_id)
    return Response(
        content=document.content,
        media_type=document.content_type,
        headers={
            # RFC 5987: um nome de arquivo com acento não cabe num header latin-1.
            'Content-Disposition': f"inline; filename*=UTF-8''{quote(document.filename)}",
        },
    )
