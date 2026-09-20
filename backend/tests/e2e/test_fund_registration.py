"""Registering a priced unit of a registry class as an asset, through HTTP."""

from datetime import date
from http import HTTPStatus

from sqlalchemy import text

from app.composition.market_data import get_fund_series_read_service
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.integrations.cvm_client import REGISTRY_PATH, TERMS_PATH, CvmFile
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.service.data_ingestion_service import DataIngestionService
from app.modules.market_data.service.fund_registry_ingestion_service import (
    FundRegistryIngestionService,
)
from app.modules.market_data.service.fund_registry_service import FundSeriesReadService
from app.modules.users.views import current_superuser, get_jwt_strategy
from tests.fixtures.cvm import (
    FIDC_HEADER,
    PLGN_CLASS,
    PLGN_FUND,
    TERMS_HEADER,
    FakeCvmClient,
    csv_bytes,
    registry_zip,
    zipped,
)

FIF_FUND = (
    '500;00888897000131;1;2000-01-01;;FIF;FUNDO COM SUBCLASSES;;Em Funcionamento Normal;;;;;;;;'
    '1;ADMIN;PJ;1;GESTORA'
)
FIF_CLASS = (
    '500;82;00888897000131;1;2000-01-01;;;Classes de Cotas de Fundos FIF;CLASSE FIF;'
    'Em Funcionamento Normal;;Renda Fixa;;;;;;;;Aberto;N;Público Geral;1;2026-08-31;;;;;;'
)
SUBCLASS_A = (
    '82;MZMRC1747322915;1;2025-05-15;2025-05-14;SUBCLASSE A;Em Funcionamento Normal;;Aberto;N;'
    'Público Geral;N;N;N'
)
SUBCLASS_PREV = (
    '82;RBMFN1747320951;1;2025-05-15;2025-05-14;SUBCLASSE PREV;Em Funcionamento Normal;;Aberto;N;'
    'Público Geral;S;N;N'
)
FIDC_JULY = 'FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_202607.zip'
FIDC_AUGUST = 'FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_202608.zip'


async def seed_registry(tmp_path) -> dict[str, int]:
    client = FakeCvmClient(tmp_path)
    client.publish(
        REGISTRY_PATH,
        registry_zip(
            funds=[PLGN_FUND, FIF_FUND],
            classes=[PLGN_CLASS, FIF_CLASS],
            subclasses=[SUBCLASS_A, SUBCLASS_PREV],
        ),
    )
    client.publish(TERMS_PATH, csv_bytes(TERMS_HEADER))
    await FundRegistryIngestionService(
        uow_factory=UnitOfWork,
        ingestion_service=DataIngestionService(uow_factory=UnitOfWork),
        client=client,
    ).run()
    async with UnitOfWork() as uow:
        classes = await uow.fund_registry.get_class_ids_by_registry_id()
        subclasses = {
            item.code: item.id for item in await uow.fund_registry.list_subclasses(classes[82])
        }
    return {
        'plgn': classes[31847],
        'fif': classes[82],
        'subclass_a': subclasses['MZMRC1747322915'],
        'subclass_prev': subclasses['RBMFN1747320951'],
    }


def fidc_client(tmp_path) -> FakeCvmClient:
    client = FakeCvmClient(tmp_path)
    client.publish(
        FIDC_JULY,
        zipped({
            'inf_mensal_fidc_tab_X_2_202607.csv': csv_bytes(
                FIDC_HEADER,
                'Classe;55.139.905/0001-39;PLGN;2026-07-31;Subclasse Senior Subclasse 1;'
                '30556890.32564600;1.42053670',
                'Classe;55.139.905/0001-39;PLGN;2026-07-31;Subclasse Subordinada Subordinada 1 |;'
                '0;0',
            )
        }),
    )
    # August is published, but PLGN has not filed in it yet.
    client.publish(
        FIDC_AUGUST,
        zipped({
            'inf_mensal_fidc_tab_X_2_202608.csv': csv_bytes(
                FIDC_HEADER, 'Classe;11.111.111/0001-11;OUTRO;2026-08-31;Senior;1;1'
            )
        }),
    )
    client.listings['fidc'] = [
        CvmFile(path=FIDC_JULY, period='202607'),
        CvmFile(path=FIDC_AUGUST, period='202608'),
    ]
    return client


async def test_series_choices_are_read_before_any_asset_exists(client, tmp_path):
    ids = await seed_registry(tmp_path)
    source = fidc_client(tmp_path)
    app = client._transport.app
    app.dependency_overrides[get_fund_series_read_service] = lambda: FundSeriesReadService(
        uow=UnitOfWork(), client=source
    )

    response = await client.get(f'/market_data/fund_registry/class/{ids["plgn"]}/series')
    fif = await client.get(f'/market_data/fund_registry/class/{ids["fif"]}/series')

    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert body['applicable'] is True
    assert body['filing_date'] == '2026-07-31'
    assert body['files_read'] == 2
    assert [(item['label'], item['has_shares']) for item in body['candidates']] == [
        ('Subclasse Senior Subclasse 1', True),
        ('Subclasse Subordinada Subordinada 1 |', False),
    ]
    assert fif.json()['applicable'] is False
    assert list(tmp_path.iterdir()) == []


async def test_a_regular_user_can_find_confirm_and_reuse_a_fund_but_cannot_edit_aliases(
    client, seed_user, db, factory, tmp_path
):
    ids = await seed_registry(tmp_path)
    seed_user.is_superuser = False
    await db.execute(
        text('UPDATE public."user" SET is_superuser = false WHERE id = :id'), {'id': seed_user.id}
    )
    await db.commit()
    client.headers['Authorization'] = f'Bearer {await get_jwt_strategy().write_token(seed_user)}'
    app = client._transport.app
    app.dependency_overrides.pop(current_superuser)
    app.dependency_overrides[get_fund_series_read_service] = lambda: FundSeriesReadService(
        uow=UnitOfWork(), client=fidc_client(tmp_path)
    )

    search = await client.get('/market_data/fund_registry', params={'search': '55.139.905/0001-39'})
    detail = await client.get(f'/market_data/fund_registry/class/{ids["plgn"]}')
    filing = await client.get(f'/market_data/fund_registry/class/{ids["plgn"]}/series')
    assert search.status_code == detail.status_code == filing.status_code == HTTPStatus.OK
    assert search.json()[0]['id'] == ids['plgn']
    payload = {
        'fund_registry_class_id': ids['plgn'],
        'asset_type_id': ASSET_TYPE.FI,
        'series_label': 'Subclasse Senior Subclasse 1',
    }
    first = await client.post('/market_data/asset/fund', json=payload)
    second = await client.post('/market_data/asset/fund', json=payload)
    assert first.status_code == second.status_code == HTTPStatus.OK
    assert first.json()['id'] == second.json()['id']
    portfolio_id = await factory.portfolio()
    broker_id = await factory.broker()
    await db.commit()
    bought = await client.post(
        '/portfolio/transaction',
        json={
            'portfolio_id': portfolio_id,
            'broker_id': broker_id,
            'asset_id': first.json()['id'],
            'quantity': 100,
            'price': 1.43,
            'currency': 'BRL',
            'date': '2026-09-10T12:00:00Z',
        },
    )
    assert bought.status_code == HTTPStatus.OK
    stored_asset = await db.scalar(
        text('SELECT asset_id FROM portfolio.transaction WHERE portfolio_id = :id'),
        {'id': portfolio_id},
    )
    assert stored_asset == first.json()['id']
    forbidden = await client.put(
        f'/market_data/asset/fund/{first.json()["id"]}/series-aliases',
        json={'aliases': [{'label': 'Other'}]},
    )
    assert forbidden.status_code == HTTPStatus.FORBIDDEN


async def test_a_fidc_requires_a_series_and_a_legacy_asset_can_be_resolved(client, db, tmp_path):
    ids = await seed_registry(tmp_path)
    payload = {'fund_registry_class_id': ids['plgn'], 'asset_type_id': ASSET_TYPE.FI}
    missing = await client.post('/market_data/asset/fund', json=payload)
    assert missing.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    created = await client.post(
        '/market_data/asset/fund', json={**payload, 'series_label': 'Senior'}
    )
    asset_id = created.json()['id']
    await db.execute(
        text('UPDATE asset.fund SET fund_share_series_id = NULL WHERE asset_id = :id'),
        {'id': asset_id},
    )
    await db.commit()
    resolved = await client.put(
        f'/market_data/asset/fund/{asset_id}/series', json={'series_label': 'Senior'}
    )
    assert resolved.status_code == HTTPStatus.OK
    assert resolved.json()['id'] == asset_id
    fund = (await client.get(f'/market_data/asset/{asset_id}')).json()['fund']
    assert fund['fund_share_series_id'] is not None
    version = await db.scalar(
        text('SELECT selection_version FROM asset.fund WHERE asset_id = :id'), {'id': asset_id}
    )
    assert version == 2


async def test_search_and_class_detail_read_the_registry(client, tmp_path):
    ids = await seed_registry(tmp_path)

    by_name = await client.get('/market_data/fund_registry', params={'search': 'plgn'})
    by_cnpj = await client.get('/market_data/fund_registry', params={'search': '55.139.905/0001'})
    by_manager = await client.get('/market_data/fund_registry', params={'search': 'polígono'})
    detail = await client.get(f'/market_data/fund_registry/class/{ids["fif"]}')

    for response in (by_name, by_cnpj, by_manager):
        assert [item['id'] for item in response.json()] == [ids['plgn']]
    assert by_name.json()[0]['fund']['kind'] == 'FIDC'
    assert [item['code'] for item in detail.json()['subclasses']] == [
        'MZMRC1747322915',
        'RBMFN1747320951',
    ]
    assert detail.json()['registered_units'] == []


async def test_distinct_units_register_and_duplicates_or_foreign_members_are_refused(
    client, db, tmp_path
):
    ids = await seed_registry(tmp_path)

    plgn = await client.post(
        '/market_data/asset/fund',
        json={
            'fund_registry_class_id': ids['plgn'],
            'asset_type_id': ASSET_TYPE.FI,
            'series_label': 'Subclasse Senior Subclasse 1',
        },
    )
    same_label_again = await client.post(
        '/market_data/asset/fund',
        json={
            'fund_registry_class_id': ids['plgn'],
            'asset_type_id': ASSET_TYPE.FI,
            'series_label': 'subclasse  senior subclasse 1',
        },
    )
    plgn_mezzanine = await client.post(
        '/market_data/asset/fund',
        json={
            'fund_registry_class_id': ids['plgn'],
            'asset_type_id': ASSET_TYPE.FI,
            'series_label': 'Subclasse Subordinada Mezanino 1 | Série 1',
        },
    )
    subclass_a = await client.post(
        '/market_data/asset/fund',
        json={
            'fund_registry_class_id': ids['fif'],
            'fund_registry_subclass_id': ids['subclass_a'],
            'asset_type_id': ASSET_TYPE.FI,
        },
    )
    subclass_prev = await client.post(
        '/market_data/asset/fund',
        json={
            'fund_registry_class_id': ids['fif'],
            'fund_registry_subclass_id': ids['subclass_prev'],
            'asset_type_id': ASSET_TYPE.PREV,
        },
    )
    foreign_subclass = await client.post(
        '/market_data/asset/fund',
        json={
            'fund_registry_class_id': ids['plgn'],
            'fund_registry_subclass_id': ids['subclass_a'],
            'asset_type_id': ASSET_TYPE.FI,
        },
    )
    series_on_daily_fund = await client.post(
        '/market_data/asset/fund',
        json={
            'fund_registry_class_id': ids['fif'],
            'asset_type_id': ASSET_TYPE.FI,
            'series_label': 'Senior',
        },
    )
    not_a_fund_type = await client.post(
        '/market_data/asset/fund',
        json={'fund_registry_class_id': ids['fif'], 'asset_type_id': ASSET_TYPE.STOCK},
    )

    assert plgn.status_code == HTTPStatus.OK
    assert same_label_again.status_code == HTTPStatus.OK
    assert same_label_again.json()['id'] == plgn.json()['id']
    assert plgn_mezzanine.status_code == HTTPStatus.OK
    assert subclass_a.status_code == HTTPStatus.OK
    assert subclass_prev.status_code == HTTPStatus.OK
    assert foreign_subclass.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert series_on_daily_fund.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert not_a_fund_type.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    asset = (await client.get(f'/market_data/asset/{plgn.json()["id"]}')).json()
    assert asset['ticker'] is None
    assert asset['name'] == 'PLGN EQUIPE FIC FIDC - Subclasse Senior Subclasse 1'
    assert asset['fund']['legal_id'] == '55139905000139'
    assert asset['fund']['fund_registry_class_id'] == ids['plgn']
    assert asset['fund']['fund_share_series_id'] is not None
    detail = (await client.get(f'/market_data/fund_registry/class/{ids["plgn"]}')).json()
    assert len(detail['series']) == 2
    assert len(detail['registered_units']) == 2


async def test_editing_a_registered_fund_in_the_asset_form_keeps_its_registry_link(
    client, tmp_path
):
    ids = await seed_registry(tmp_path)
    created = await client.post(
        '/market_data/asset/fund',
        json={
            'fund_registry_class_id': ids['fif'],
            'fund_registry_subclass_id': ids['subclass_a'],
            'asset_type_id': ASSET_TYPE.FI,
        },
    )
    asset_id = created.json()['id']

    updated = await client.put(
        f'/market_data/asset/{asset_id}',
        json={
            'id': asset_id,
            'name': 'Renomeado',
            'asset_type_id': ASSET_TYPE.FI,
            'legal_id': '00888897000131',
            'anbima_category': 'Renda Fixa',
        },
    )

    assert updated.status_code == HTTPStatus.OK
    fund = (await client.get(f'/market_data/asset/{asset_id}')).json()['fund']
    assert fund['fund_registry_class_id'] == ids['fif']
    assert fund['fund_registry_subclass_id'] == ids['subclass_a']
    assert fund['anbima_category'] == 'Renda Fixa'


async def test_confirmed_aliases_are_kept_and_a_label_cannot_mean_two_series(client, db, tmp_path):
    ids = await seed_registry(tmp_path)
    senior = (
        await client.post(
            '/market_data/asset/fund',
            json={
                'fund_registry_class_id': ids['plgn'],
                'asset_type_id': ASSET_TYPE.FI,
                'series_label': 'Subclasse Senior Subclasse 1',
            },
        )
    ).json()['id']
    mezzanine = (
        await client.post(
            '/market_data/asset/fund',
            json={
                'fund_registry_class_id': ids['plgn'],
                'asset_type_id': ASSET_TYPE.FI,
                'series_label': 'Mezanino 1',
            },
        )
    ).json()['id']

    old_label = {'label': 'Subclasse Senior Série 1', 'valid_to': str(date(2026, 5, 31))}
    confirmed = await client.put(
        f'/market_data/asset/fund/{senior}/series-aliases', json={'aliases': [old_label]}
    )
    repeated = await client.put(
        f'/market_data/asset/fund/{senior}/series-aliases', json={'aliases': [old_label]}
    )
    stolen = await client.put(
        f'/market_data/asset/fund/{mezzanine}/series-aliases',
        json={'aliases': [{'label': 'Subclasse Senior Serie 1', 'valid_from': '2026-01-01'}]},
    )
    later_meaning = await client.put(
        f'/market_data/asset/fund/{mezzanine}/series-aliases',
        json={'aliases': [{'label': 'Subclasse Senior Série 1', 'valid_from': '2026-06-01'}]},
    )

    assert confirmed.status_code == HTTPStatus.OK
    assert sorted(alias['label'] for alias in confirmed.json()) == [
        'subclasse senior serie 1',
        'subclasse senior subclasse 1',
    ]
    assert len(repeated.json()) == 2
    assert stolen.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert later_meaning.status_code == HTTPStatus.OK
    versions = dict(
        (
            await db.execute(
                text(
                    'SELECT asset_id, selection_version FROM asset.fund WHERE asset_id IN (:a, :b)'
                ),
                {'a': senior, 'b': mezzanine},
            )
        ).all()
    )
    # One effective confirmation each; the repeat changed nothing.
    assert versions == {senior: 2, mezzanine: 2}
