"""A sincronização é um merge, e é isso que estes testes prendem.

Os três casos que a definem — ticker nos dois lados, só no provedor, só no
cadastro — são fáceis de quebrar com uma refatoração que pareça inofensiva, e
o custo de quebrar o terceiro é o pior: um papel de renda fixa apagado leva
histórico de carteira junto.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core.exceptions import ValidationError
from app.modules.market_data.domain.assets import Asset, Exchange
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.service.asset_catalogue_sync_service import (
    AssetCatalogueSyncService,
)
from tests.fakes import FakeUnitOfWork

B3 = Exchange(id=1, code='B3', name='B3')


def _build(registered, catalogue):
    """Um serviço sobre um cadastro e um catálogo fixos.

    `assets.get` responde por entidade: a bolsa quando perguntam por ela, o
    cadastro quando perguntam por ativos.
    """
    created: list[tuple] = []

    async def get(entity, **kwargs):
        if entity is Exchange:
            return B3
        return list(registered)

    async def create(entity, data):
        created.append((entity, data))
        return [99]

    assets = SimpleNamespace(get=AsyncMock(side_effect=get), create=AsyncMock(side_effect=create))
    uow = FakeUnitOfWork(assets=assets)
    catalogue_service = SimpleNamespace(fetch_catalogue=AsyncMock(return_value=catalogue))
    cache = SimpleNamespace(delete_prefix=AsyncMock())
    service = AssetCatalogueSyncService(uow=uow, catalogue=catalogue_service, cache=cache)
    return service, uow, created


def _asset(ticker, name, logo_url=None):
    return Asset(
        id=1,
        ticker=ticker,
        name=name,
        asset_type_id=int(ASSET_TYPE.FII),
        logo_url=logo_url,
    )


@pytest.mark.asyncio
async def test_a_wrong_name_is_corrected_from_the_catalogue():
    """O caso que motivou a rotina: um nome errado guardado no banco."""
    registered = [_asset('HABT11', 'Habitasec FII')]
    catalogue = [{'ticker': 'HABT11', 'name': 'Habitat II FII', 'logo_url': 'https://l/h.png'}]
    service, uow, _ = _build(registered, catalogue)

    report = await service.sync(kinds=['fii'], dry_run=False)

    assert report['updated'] == [
        {
            'kind': 'fii',
            'ticker': 'HABT11',
            'changes': {
                'name': ('Habitasec FII', 'Habitat II FII'),
                'logo_url': (None, 'https://l/h.png'),
            },
        }
    ]
    assert registered[0].name == 'Habitat II FII'
    assert registered[0].logo_url == 'https://l/h.png'
    uow.commit.assert_awaited()


@pytest.mark.asyncio
async def test_a_dry_run_reports_without_writing():
    """O padrão da rota: primeiro se vê o que mudaria."""
    registered = [_asset('HABT11', 'Habitasec FII')]
    catalogue = [{'ticker': 'HABT11', 'name': 'Habitat II FII'}]
    service, uow, created = _build(registered, catalogue)

    report = await service.sync(kinds=['fii'], dry_run=True)

    assert report['dry_run'] is True
    assert len(report['updated']) == 1
    assert registered[0].name == 'Habitasec FII'
    assert created == []
    uow.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_a_ticker_only_in_the_catalogue_is_registered():
    service, _, created = _build([], [{'ticker': 'MXRF11', 'name': 'Maxi Renda'}])

    report = await service.sync(kinds=['fii'], dry_run=False)

    assert report['created'] == [{'kind': 'fii', 'ticker': 'MXRF11', 'name': 'Maxi Renda'}]
    entity, data = created[0]
    assert entity is Asset
    assert data['ticker'] == 'MXRF11'
    assert data['asset_type_id'] == int(ASSET_TYPE.FII)
    # Nasce na B3: é o único mercado que o provedor cataloga, e é a mesma
    # regra que decide o segmento de uma posição.
    assert data['exchange_id'] == B3.id


@pytest.mark.asyncio
async def test_a_ticker_only_in_the_registry_is_left_alone():
    """Renda fixa e tesouro não estão em catálogo nenhum, e carregam histórico."""
    registered = [_asset('CDB-BANCO-X', 'CDB Banco X')]
    service, _, created = _build(registered, [])

    report = await service.sync(kinds=['fii'], dry_run=False)

    assert report['kept_local'] == [{'kind': 'fii', 'ticker': 'CDB-BANCO-X', 'name': 'CDB Banco X'}]
    assert report['updated'] == []
    assert created == []
    assert registered[0].name == 'CDB Banco X'


@pytest.mark.asyncio
async def test_an_empty_provider_name_is_not_a_correction():
    """Trocar um nome velho por nenhum não é corrigir."""
    registered = [_asset('HABT11', 'Habitasec FII', logo_url='https://l/h.png')]
    catalogue = [{'ticker': 'HABT11', 'name': '', 'logo_url': None}]
    service, _, _ = _build(registered, catalogue)

    report = await service.sync(kinds=['fii'], dry_run=False)

    assert report['updated'] == []
    assert report['unchanged'] == 1
    assert registered[0].name == 'Habitasec FII'


@pytest.mark.asyncio
async def test_an_unknown_catalogue_is_refused():
    service, _, _ = _build([], [])

    with pytest.raises(ValidationError):
        await service.sync(kinds=['debentures'], dry_run=True)
