from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.composition.market_data import (
    get_data_ingestion_read_service,
    get_data_ingestion_service,
)
from app.modules.market_data.api.ingestion.router import router
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.users.views import current_superuser

HTTP_OK = 200
HTTP_UNPROCESSABLE_ENTITY = 422


@pytest.mark.asyncio
async def test_market_data_series_route_leaves_item_selection_to_backend():
    execution = {
        'id': 4,
        'ingestion_type': 'market_data_series',
        'task_id': 'task-4',
        'trigger': 'manual',
        'status': 'queued',
        'force_full_history': False,
        'parameters': {'item_ids': []},
        'requested_by_user_id': 7,
        'requested_at': '2026-08-08T12:00:00Z',
        'started_at': None,
        'finished_at': None,
        'total_items': 0,
        'processed_items': 0,
        'succeeded_items': 0,
        'failed_items': 0,
        'fetched_rows': 0,
        'upserted_rows': 0,
        'error': None,
    }
    requested_execution = SimpleNamespace(**execution)
    write_service = SimpleNamespace(
        request_series_execution=AsyncMock(return_value=requested_execution),
        set_task_id=AsyncMock(return_value=requested_execution),
        fail=AsyncMock(),
    )
    app = FastAPI()
    app.include_router(router, prefix='/market_data')
    app.dependency_overrides[current_superuser] = lambda: SimpleNamespace(id=7)
    app.dependency_overrides[get_data_ingestion_service] = lambda: write_service

    # Dispatched by name so the router keeps no import of the task itself.
    with patch(
        'app.modules.market_data.api.ingestion.router.run_task_by_name',
        return_value=SimpleNamespace(id='task-4'),
    ) as run_task:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url='http://test',
        ) as client:
            response = await client.post(
                '/market_data/ingestions/market_data_series',
                json={'force_full_history': False},
            )

    assert response.status_code == HTTP_OK
    write_service.request_series_execution.assert_awaited_once_with(
        requested_by_user_id=7,
        force_full_history=False,
    )
    run_task.assert_called_once()
    write_service.set_task_id.assert_awaited_once_with(4, 'task-4')
    write_service.fail.assert_not_awaited()


@pytest.mark.asyncio
async def test_market_data_series_route_rejects_internal_ids_from_client():
    app = FastAPI()
    app.include_router(router, prefix='/market_data')
    app.dependency_overrides[current_superuser] = lambda: SimpleNamespace(id=7)

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url='http://test',
    ) as client:
        response = await client.post(
            '/market_data/ingestions/market_data_series',
            json={'item_ids': [2, 3], 'force_full_history': False},
        )

    assert response.status_code == HTTP_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_each_ingestion_history_route_filters_its_own_type():
    read_service = SimpleNamespace(
        list_quote_executions=AsyncMock(return_value=[]),
        list_series_executions=AsyncMock(return_value=[]),
        list_usd_brl_executions=AsyncMock(return_value=[]),
    )
    app = FastAPI()
    app.include_router(router, prefix='/market_data')
    app.dependency_overrides[current_superuser] = lambda: SimpleNamespace(id=7)
    app.dependency_overrides[get_data_ingestion_read_service] = lambda: read_service

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url='http://test',
    ) as client:
        for ingestion_type in DataIngestionType:
            response = await client.get(f'/market_data/ingestions/{ingestion_type.value}')
            assert response.status_code == HTTP_OK

    read_service.list_quote_executions.assert_awaited_once_with(limit=50)
    read_service.list_series_executions.assert_awaited_once_with(limit=50)
    read_service.list_usd_brl_executions.assert_awaited_once_with(limit=50)
