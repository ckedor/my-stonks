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
        get_most_visited_assets=AsyncMock(return_value=[]),
    )
    portfolios = SimpleNamespace(count_asset_references=AsyncMock(return_value={}))
    uow = FakeUnitOfWork(repository=repository, assets=repository, portfolios=portfolios)
    service = AssetService(
        uow=uow,
        cache=SimpleNamespace(delete=AsyncMock(), delete_prefix=AsyncMock()),
    )
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

    # Por prefixo: a chave literal do decorator não é contrato desta função.
    service.cache.delete_prefix.assert_any_await('assets_list:')
    deleted_keys = {call.args[0] for call in service.cache.delete.await_args_list}
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


@pytest.mark.asyncio
async def test_favorite_assets_filters_the_universe_before_applying_the_limit():
    service, uow = build_service()

    result = await service.list_favorite_assets(
        user_id=7,
        limit=8,
        asset_type_id=1,
        asset_ids=[45, 46, 47],
    )

    assert result == []
    uow.assets.get_most_visited_assets.assert_awaited_once_with(
        7,
        8,
        asset_type_id=1,
        asset_ids=[45, 46, 47],
    )
