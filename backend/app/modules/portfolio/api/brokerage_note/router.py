from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.composition.portfolio import get_brokerage_note_import_service
from app.entrypoints.worker.task_runner import run_task_by_name
from app.modules.portfolio.service.brokerage_note_import_service import (
    BrokerageNoteImportService,
)

from .schema import (
    BrokerageNoteDraftResponse,
    BrokerageNoteResponse,
    ImportRequest,
    ImportResponse,
    ReconciliationGroupResponse,
    ReconciliationRequest,
)

#: Dispatched by name, as in the transaction router.
RECALCULATE_ASSET_POSITION_TASK = 'recalculate_asset_position'

router = APIRouter(prefix='/brokerage_note', tags=['Portfolio Brokerage Note'])


@router.get('', response_model=list[BrokerageNoteResponse])
async def list_brokerage_notes(
    portfolio_id: int = Query(...),
    service: BrokerageNoteImportService = Depends(get_brokerage_note_import_service),
):
    """Imported notes of the portfolio, newest trading day first."""
    return await service.list_notes(portfolio_id)


@router.post('/extraction', response_model=BrokerageNoteDraftResponse)
async def extract_brokerage_note(
    portfolio_id: int = Form(...),
    file: UploadFile = File(..., description='Nota de corretagem em PDF'),
    service: BrokerageNoteImportService = Depends(get_brokerage_note_import_service),
):
    """Read a brokerage note and show what importing it would do. Writes nothing."""
    content = await file.read()
    return await service.extract(
        portfolio_id=portfolio_id,
        filename=file.filename or 'nota.pdf',
        content=content,
    )


@router.post('/reconciliation', response_model=list[ReconciliationGroupResponse])
async def reconcile_brokerage_note(
    request: ReconciliationRequest,
    service: BrokerageNoteImportService = Depends(get_brokerage_note_import_service),
):
    """Cross reviewed lines with the portfolio again, without reading the PDF again."""
    return await service.reconcile(
        portfolio_id=request.portfolio_id,
        lines=[line.to_domain() for line in request.lines],
    )


@router.post('', response_model=ImportResponse)
async def import_brokerage_note(
    request: ImportRequest,
    service: BrokerageNoteImportService = Depends(get_brokerage_note_import_service),
):
    """Save one note and apply the decisions taken over a reconciliation that must still hold."""
    result = await service.apply(
        portfolio_id=request.portfolio_id,
        note=request.note.to_domain(),
        lines=[line.to_domain() for line in request.lines],
        decisions=[decision.to_domain() for decision in request.decisions],
    )
    for asset_id in result.asset_ids:
        run_task_by_name(RECALCULATE_ASSET_POSITION_TASK, request.portfolio_id, asset_id)
    return result
