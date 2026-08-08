from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from app.core.exceptions import BusinessRuleError
from app.modules.market_data.service.asset_service import AssetService


def build_service():
    repository = SimpleNamespace(
        get=AsyncMock(),
        delete=AsyncMock(),
        get_portfolio_reference_counts=AsyncMock(return_value={}),
        detach_ingestion_attempts=AsyncMock(),
    )

    class FakeUnitOfWork:
        def __init__(self):
            self.repository = repository
            self.assets = repository
            self.exit_errors = []

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            self.exit_errors.append(exc_type)

    uow = FakeUnitOfWork()
    service = AssetService(
        uow=uow,
        cache=SimpleNamespace(delete=AsyncMock()),
    )
    service.repo = repository
    service.test_uow = uow
    return service


@pytest.mark.asyncio
async def test_update_asset_invalidates_old_and_new_ticker_cache_keys():
    service = build_service()
    asset = SimpleNamespace(
        id=33,
        ticker='CPLE6',
        name='Copel PNB',
        asset_type_id=4,
        exchange_id=None,
    )
    service.repo.get.return_value = asset
    service._delete_subclass = AsyncMock()
    service._create_subclass = AsyncMock()

    await service.update_asset({
        'id': 33,
        'ticker': 'CPLE3',
        'name': 'Copel',
        'asset_type_id': 4,
        'exchange_id': None,
    })

    deleted_keys = {call.args[0] for call in service.cache.delete.await_args_list}
    assert 'assets_list::' in deleted_keys
    assert 'market_data:asset:id:33' in deleted_keys
    assert 'market_data:asset:ticker:4:CPLE6' in deleted_keys
    assert 'market_data:asset:ticker:4:CPLE3' in deleted_keys
    assert asset.ticker == 'CPLE3'


@pytest.mark.asyncio
async def test_delete_asset_with_portfolio_history_is_rejected_without_deleting_data():
    service = build_service()
    service.repo.get.return_value = SimpleNamespace(
        id=33,
        ticker='CPLE3',
        asset_type_id=4,
    )
    service.repo.get_portfolio_reference_counts.return_value = {
        'transactions': 8,
        'positions': 486,
    }

    with pytest.raises(BusinessRuleError, match='não pode ser excluído'):
        await service.delete_asset(33)

    service.repo.delete.assert_not_awaited()
    assert service.test_uow.exit_errors == [BusinessRuleError]
