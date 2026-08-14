from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import BusinessRuleError
from app.modules.market_data.service.asset_service import AssetService
from tests.fakes import FakeUnitOfWork


def build_service():
    repository = SimpleNamespace(
        get=AsyncMock(),
        delete=AsyncMock(),
        create=AsyncMock(),
        detach_ingestion_attempts=AsyncMock(),
    )
    portfolios = SimpleNamespace(count_asset_references=AsyncMock(return_value={}))
    uow = FakeUnitOfWork(repository=repository, assets=repository, portfolios=portfolios)
    service = AssetService(uow=uow, cache=SimpleNamespace(delete=AsyncMock()))
    return service, uow


@pytest.mark.asyncio
async def test_update_asset_invalidates_old_and_new_ticker_cache_keys():
    service, uow = build_service()
    asset = SimpleNamespace(
        id=33,
        ticker='CPLE6',
        name='Copel PNB',
        asset_type_id=4,
        exchange_id=None,
    )
    uow.assets.get.return_value = asset
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
    service, uow = build_service()
    uow.assets.get.return_value = SimpleNamespace(
        id=33,
        ticker='CPLE3',
        asset_type_id=4,
    )
    uow.portfolios.count_asset_references.return_value = {
        'transactions': 8,
        'positions': 486,
    }

    with pytest.raises(BusinessRuleError, match='não pode ser excluído'):
        await service.delete_asset(33)

    uow.assets.delete.assert_not_awaited()
    assert uow.exit_errors == [BusinessRuleError]
