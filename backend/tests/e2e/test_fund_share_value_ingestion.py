"""Share-value ingestion against a real database and a fake regulator.

Each test names the situation it proves. Dates follow the case that motivated
the feature: PLGN Equipe, a FIDC bought on 2026-09-10 through BTG, whose last
filing on 2026-09-17 was July.
"""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import text

from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.domain.constants import ASSET_TYPE
from app.modules.market_data.domain.ingestion import DataIngestionExecution
from app.modules.market_data.service.asset_service import AssetService
from app.modules.market_data.service.data_ingestion_service import DataIngestionService
from app.modules.market_data.service.fund_share_value_ingestion_service import (
    FundShareValueIngestionService,
)
from tests.fixtures.cvm import (
    FakeCvmClient,
    daily_path,
    fidc_path,
    publish_daily,
    publish_fidc,
)

PLGN = '55.139.905/0001-39'
FIF = '00.888.897/0001-31'
SENIOR = 'Subclasse Senior Subclasse 1'
OLD_SENIOR = 'Subclasse Senior Série 1'
SUBORDINATE = 'Subclasse Subordinada Subordinada 1 |'
#: Thursday 2026-09-17, 12:00 in Brasília.
THURSDAY = datetime(2026, 9, 17, 15, tzinfo=UTC)
#: The following Tuesday, when the weekly revision sweep is due.
TUESDAY = datetime(2026, 9, 22, 12, 15, tzinfo=UTC)
BUY = date(2026, 9, 10)


async def test_a_manual_subset_does_not_consume_other_funds_weekly_revision(db, tmp_path):
    other_cnpj = '11.111.111/0001-11'
    first = await register(
        await registry_class(db, registry_id=82, cnpj='00888897000131', kind='FIF')
    )
    second = await register(
        await registry_class(db, registry_id=83, cnpj='11111111000111', kind='FIF')
    )
    client = FakeCvmClient(tmp_path)
    for period, day in [('202605', '2026-05-04'), ('202609', '2026-09-16')]:
        publish_daily(client, period, [f'{FIF};;{day};10', f'{other_cnpj};;{day};20'])
    since = date(2026, 5, 4)
    first_since = date(2026, 9, 16)
    await ingestion(client).run(
        fund_asset_ids_since={first: first_since, second: since}, now=THURSDAY
    )
    publish_daily(client, '202605', [f'{FIF};;2026-05-04;10', f'{other_cnpj};;2026-05-04;21'])

    await ingestion(client).run(fund_asset_ids_since={first: first_since}, now=TUESDAY)
    run = await ingestion(client).run(
        fund_asset_ids_since={first: first_since, second: since}, now=TUESDAY
    )

    assert run.changed == {second: since}
    assert (since, Decimal('21')) in await quotes(db, second)
    execution = await db.get(DataIngestionExecution, run.execution_id)
    # Both units share files, but only the still-due fund needs May again.
    may = next(entry for entry in execution.parameters['files'] if entry['period'] == '202605')
    assert may['asset_ids'] == [second]


async def test_an_empty_run_does_not_mark_any_revision_completed(db, tmp_path):
    await ingestion(FakeCvmClient(tmp_path)).run(fund_asset_ids_since={}, now=TUESDAY)
    count = await db.scalar(text('SELECT count(*) FROM market_data.ingestion_checkpoint'))
    assert count == 0


@pytest.mark.parametrize('replacement', [[], [f'{FIF};;2026-09-11;11']])
async def test_retifications_remove_or_move_quotes_and_dispatch_the_earliest_change(
    db, tmp_path, replacement
):
    asset = await register(
        await registry_class(db, registry_id=82, cnpj='00888897000131', kind='FIF')
    )
    client = FakeCvmClient(tmp_path)
    publish_daily(client, '202608', [f'{FIF};;2026-08-31;9'])
    publish_daily(client, '202609', [f'{FIF};;2026-09-10;10', f'{FIF};;2026-09-16;12'])
    await ingestion(client).run(fund_asset_ids_since={asset: BUY}, now=THURSDAY)
    publish_daily(client, '202609', [*replacement, f'{FIF};;2026-09-16;12'])

    run = await ingestion(client).run(fund_asset_ids_since={asset: BUY}, now=THURSDAY)

    values = dict(await quotes(db, asset))
    assert BUY not in values
    assert values[date(2026, 8, 31)] == Decimal('9')
    assert values[date(2026, 9, 16)] == Decimal('12')
    if replacement:
        assert values[date(2026, 9, 11)] == Decimal('11')
    assert run.changed == {asset: date(2026, 8, 31)}
    unchanged = await ingestion(client).run(fund_asset_ids_since={asset: BUY}, now=THURSDAY)
    assert unchanged.changed == {}


async def test_a_withdrawn_monthly_seed_is_removed_and_an_earlier_seed_is_discovered(db, tmp_path):
    asset = await register(await plgn_class(db), series_label=SENIOR)
    client = FakeCvmClient(tmp_path)
    publish_fidc(client, '202606', [f'{PLGN};2026-06-30;{SENIOR};1;1.3'])
    plgn_months(client)
    await ingestion(client).run(fund_asset_ids_since={asset: BUY}, now=THURSDAY)
    publish_fidc(client, '202607', [])

    run = await ingestion(client).run(fund_asset_ids_since={asset: BUY}, now=THURSDAY)

    assert await quotes(db, asset) == [(date(2026, 6, 30), Decimal('1.3'))]
    assert (await attempts(db, run.execution_id))[asset] == ('success', None)
    assert run.changed == {asset: date(2026, 6, 30)}


async def test_a_failed_reconciliation_rolls_back_withdrawals_and_coverage(
    db, tmp_path, monkeypatch
):
    from app.modules.market_data.repositories.source_file_repository import SourceFileRepository

    asset = await register(
        await registry_class(db, registry_id=82, cnpj='00888897000131', kind='FIF')
    )
    client = FakeCvmClient(tmp_path)
    publish_daily(client, '202609', [f'{FIF};;2026-09-10;10'])
    await ingestion(client).run(fund_asset_ids_since={asset: BUY}, now=THURSDAY)
    previous_coverage = await coverage(db, asset)
    publish_daily(client, '202609', [])

    async def fail_coverage(self, coverage):
        raise RuntimeError('Coverage write failed')

    with monkeypatch.context() as patch:
        patch.setattr(SourceFileRepository, 'add_coverage', fail_coverage)
        failed = await ingestion(client).run(fund_asset_ids_since={asset: BUY}, now=THURSDAY)
    assert failed.changed == {}
    assert await quotes(db, asset) == [(BUY, Decimal('10'))]
    assert await coverage(db, asset) == previous_coverage

    # A malformed new body must also preserve the last applied snapshot.
    publish_daily(client, '202609', [f'{FIF};;2026-09-10;invalid'])
    malformed = await ingestion(client).run(fund_asset_ids_since={asset: BUY}, now=THURSDAY)
    assert (await attempts(db, malformed.execution_id))[asset][0] == 'failure'
    assert await quotes(db, asset) == [(BUY, Decimal('10'))]


async def registry_class(db, *, registry_id, cnpj, kind, subclasses=()) -> int:
    fund_id = (
        await db.execute(
            text(
                'INSERT INTO asset.fund_registry (registry_id, cnpj, name, kind, status) '
                "VALUES (:id, :cnpj, 'Fundo', :kind, 'Em Funcionamento Normal') RETURNING id"
            ),
            {'id': registry_id, 'cnpj': cnpj, 'kind': kind},
        )
    ).scalar_one()
    class_id = (
        await db.execute(
            text(
                'INSERT INTO asset.fund_registry_class (registry_id, fund_registry_id, cnpj, name) '
                "VALUES (:id, :fund_id, :cnpj, 'Classe') RETURNING id"
            ),
            {'id': registry_id, 'fund_id': fund_id, 'cnpj': cnpj},
        )
    ).scalar_one()
    for code in subclasses:
        await db.execute(
            text(
                'INSERT INTO asset.fund_registry_subclass (fund_registry_class_id, code, name) '
                "VALUES (:class_id, :code, 'Subclasse')"
            ),
            {'class_id': class_id, 'code': code},
        )
    return class_id


async def plgn_class(db) -> int:
    return await registry_class(db, registry_id=31847, cnpj='55139905000139', kind='FIDC')


async def register(class_id, **choice) -> int:
    service = AssetService(uow=UnitOfWork(), cache=RedisService())
    created = await service.register_fund(
        fund_registry_class_id=class_id, asset_type_id=ASSET_TYPE.FI, **choice
    )
    return created['id']


def ingestion(client) -> FundShareValueIngestionService:
    return FundShareValueIngestionService(
        uow_factory=UnitOfWork,
        ingestion_service=DataIngestionService(uow_factory=UnitOfWork),
        client=client,
    )


async def quotes(db, asset_id) -> list[tuple[date, Decimal]]:
    rows = await db.execute(
        text(
            "SELECT date, close FROM market_data.quote WHERE asset_id = :id AND source = 'cvm' "
            'ORDER BY date'
        ),
        {'id': asset_id},
    )
    return [(row.date, row.close) for row in rows]


async def coverage(db, asset_id) -> list[str]:
    rows = await db.execute(
        text(
            'SELECT f.period FROM market_data.fund_share_value_coverage c '
            'JOIN market_data.source_file f ON f.id = c.source_file_id '
            'WHERE c.asset_id = :id ORDER BY f.period'
        ),
        {'id': asset_id},
    )
    return [row.period for row in rows]


async def attempts(db, execution_id) -> dict[int, tuple[str, str | None]]:
    rows = await db.execute(
        text(
            'SELECT item_id, status, error FROM market_data.data_ingestion_attempt '
            'WHERE execution_id = :id'
        ),
        {'id': execution_id},
    )
    return {row.item_id: (row.status, row.error) for row in rows}


def plgn_months(client, *, august_filed=False):
    publish_fidc(
        client,
        '202607',
        [
            f'{PLGN};2026-07-31;{SENIOR};30556890.33;1.42053670',
            f'{PLGN};2026-07-31;{SUBORDINATE};0;0',
        ],
    )
    august = ['11.111.111/0001-11;2026-08-31;Senior;1;1']
    if august_filed:
        august.append(f'{PLGN};2026-08-31;{SENIOR};30556890.33;1.44100000')
    publish_fidc(client, '202608', august)


# ---------------------------------------------------------------------------
# First purchase
# ---------------------------------------------------------------------------


async def test_a_first_purchase_without_any_position_is_seeded_by_the_last_filing_before_it(
    db, tmp_path
):
    """September not published, August without PLGN, July filed: July seeds the buy."""
    asset_id = await register(await plgn_class(db), series_label=SENIOR)
    client = FakeCvmClient(tmp_path)
    plgn_months(client)

    run = await ingestion(client).run(fund_asset_ids_since={asset_id: BUY}, now=THURSDAY)

    assert await quotes(db, asset_id) == [(date(2026, 7, 31), Decimal('1.42053670'))]
    assert run.changed == {asset_id: date(2026, 7, 31)}
    assert (await attempts(db, run.execution_id))[asset_id] == ('success', None)
    execution = await db.get(DataIngestionExecution, run.execution_id)
    files = execution.parameters['files']
    assert {'dataset': 'fidc_monthly', 'period': '202609', 'status': 'pending_publication'} in files
    assert [(f['period'], f['status'], f.get('reasons')) for f in files if 'reasons' in f] == [
        ('202608', 'downloaded', ['seed']),
        ('202607', 'downloaded', ['seed']),
    ]
    assert await coverage(db, asset_id) == ['202607', '202608']
    assert list(tmp_path.iterdir()) == []

    # The next day nothing changed: both files answer 304 and nothing is written.
    again = await ingestion(client).run(fund_asset_ids_since={asset_id: BUY}, now=THURSDAY)
    assert client.downloaded() == [fidc_path('202608'), fidc_path('202607')]
    assert again.changed == {}

    # August arrives with PLGN in it: the filed value replaces July as the price of the buy.
    plgn_months(client, august_filed=True)
    later = await ingestion(client).run(fund_asset_ids_since={asset_id: BUY}, now=THURSDAY)
    assert await quotes(db, asset_id) == [
        (date(2026, 7, 31), Decimal('1.42053670')),
        (date(2026, 8, 31), Decimal('1.44100000')),
    ]
    assert later.changed == {asset_id: date(2026, 8, 31)}


async def test_history_exhausted_without_a_value_before_the_purchase_names_the_gap(db, tmp_path):
    asset_id = await register(await plgn_class(db), series_label=SENIOR)
    client = FakeCvmClient(tmp_path)
    publish_fidc(client, '202608', ['11.111.111/0001-11;2026-08-31;Senior;1;1'])

    run = await ingestion(client).run(fund_asset_ids_since={asset_id: BUY}, now=THURSDAY)

    status, error = (await attempts(db, run.execution_id))[asset_id]
    assert status == 'failure'
    assert 'missing_seed' in error
    assert 'from 2026-08-01 to 2026-09-10' in error


# ---------------------------------------------------------------------------
# Retrodated purchase
# ---------------------------------------------------------------------------


async def test_a_retrodated_purchase_reads_history_the_newer_quotes_do_not_cover(db, tmp_path):
    asset_id = await register(await plgn_class(db), series_label=SENIOR)
    client = FakeCvmClient(tmp_path)
    publish_fidc(client, '202605', [f'{PLGN};2026-05-29;{SENIOR};1;1.38000000'])
    publish_fidc(client, '202606', [f'{PLGN};2026-06-30;{SENIOR};1;1.39374974'])
    plgn_months(client)
    await ingestion(client).run(fund_asset_ids_since={asset_id: BUY}, now=THURSDAY)
    served_before = len(client.downloaded())

    run = await ingestion(client).run(
        fund_asset_ids_since={asset_id: date(2026, 6, 15)}, now=THURSDAY
    )

    assert await quotes(db, asset_id) == [
        (date(2026, 5, 29), Decimal('1.38000000')),
        (date(2026, 6, 30), Decimal('1.39374974')),
        (date(2026, 7, 31), Decimal('1.42053670')),
    ]
    assert run.changed == {asset_id: date(2026, 5, 29)}
    # July and August validators were stored by the first run, but both were
    # applied for a purchase in September only: they are read again rather than
    # skipped on a 304, and May is reached to seed the June purchase.
    assert client.downloaded()[served_before:] == [
        fidc_path('202606'),
        fidc_path('202607'),
        fidc_path('202608'),
        fidc_path('202605'),
    ]


# ---------------------------------------------------------------------------
# Partial failure
# ---------------------------------------------------------------------------


async def test_one_fund_failing_neither_covers_it_nor_stops_the_others(db, tmp_path):
    ambiguous = await register(await plgn_class(db), series_label=SENIOR)
    # A legacy asset created before explicit series confirmation was required.
    await db.execute(
        text('UPDATE asset.fund SET fund_share_series_id = NULL WHERE asset_id = :id'),
        {'id': ambiguous},
    )
    await db.commit()
    fif_class = await registry_class(
        db, registry_id=82, cnpj='00888897000131', kind='FIF', subclasses=['MZMRC1747322915']
    )
    async with UnitOfWork() as uow:
        subclass_id = (await uow.fund_registry.list_subclasses(fif_class))[0].id
    daily_fund = await register(fif_class, fund_registry_subclass_id=subclass_id)
    client = FakeCvmClient(tmp_path)
    publish_fidc(
        client,
        '202609',
        [
            f'{PLGN};2026-09-10;{OLD_SENIOR};10;1.1',
            f'{PLGN};2026-09-10;Subclasse Senior Série 2;10;1.2',
        ],
    )
    publish_daily(
        client,
        '202609',
        [
            f'{FIF};;2026-09-10;44.63',
            f'{FIF};MZMRC1747322915;2026-09-10;72.96',
            f'{FIF};RBMFN1747320951;2026-09-10;73.28',
        ],
    )

    run = await ingestion(client).run(
        fund_asset_ids_since={ambiguous: BUY, daily_fund: BUY}, now=THURSDAY
    )

    results = await attempts(db, run.execution_id)
    assert results[ambiguous][0] == 'failure'
    assert 'confirm the series' in results[ambiguous][1]
    assert results[daily_fund] == ('success', None)
    assert await quotes(db, daily_fund) == [(BUY, Decimal('72.96000000'))]
    assert await quotes(db, ambiguous) == []
    assert await coverage(db, ambiguous) == []
    execution = await db.get(DataIngestionExecution, run.execution_id)
    assert execution.status == 'partial_success'


async def test_a_file_that_cannot_be_read_covers_nobody_and_is_read_again_next_run(db, tmp_path):
    fif_class = await registry_class(db, registry_id=82, cnpj='00888897000131', kind='FIF')
    asset_id = await register(fif_class)
    client = FakeCvmClient(tmp_path)
    publish_daily(client, '202609', [f'{FIF};;2026-09-10;44.63'])
    client.failures.add(daily_path('202609'))

    failed = await ingestion(client).run(fund_asset_ids_since={asset_id: BUY}, now=THURSDAY)
    client.failures.clear()
    recovered = await ingestion(client).run(fund_asset_ids_since={asset_id: BUY}, now=THURSDAY)

    assert (await attempts(db, failed.execution_id))[asset_id][0] == 'failure'
    assert (await attempts(db, recovered.execution_id))[asset_id] == ('success', None)
    assert await quotes(db, asset_id) == [(BUY, Decimal('44.63000000'))]
    # No validators were stored for the failed read, so the retry was unconditional.
    assert client.requests[-1] == (daily_path('202609'), None)


async def test_an_abort_before_a_file_is_applied_leaves_no_quotes_and_no_coverage(db, tmp_path):
    asset_id = await register(
        await registry_class(db, registry_id=82, cnpj='00888897000131', kind='FIF')
    )
    client = FakeCvmClient(tmp_path)
    publish_daily(client, '202609', [f'{FIF};;2026-09-10;44.63'])
    tracking = DataIngestionService(uow_factory=UnitOfWork)

    async def aborted(execution_id):
        return True

    tracking.is_aborted = aborted
    service = FundShareValueIngestionService(
        uow_factory=UnitOfWork, ingestion_service=tracking, client=client
    )

    await service.run(fund_asset_ids_since={asset_id: BUY}, now=THURSDAY)

    assert client.requests == []
    assert await quotes(db, asset_id) == []
    assert await coverage(db, asset_id) == []


# ---------------------------------------------------------------------------
# Label change
# ---------------------------------------------------------------------------


async def test_a_changed_label_fails_until_confirmed_and_then_replays_both_periods(db, tmp_path):
    asset_id = await register(await plgn_class(db), series_label=SENIOR)
    client = FakeCvmClient(tmp_path)
    publish_fidc(
        client,
        '2025',
        [
            f'{PLGN};2025-05-30;{OLD_SENIOR};27587584.51;1.14000000',
            f'{PLGN};2025-06-30;{OLD_SENIOR};27587584.51;1.15000000',
            f'{PLGN};2025-06-30;{SUBORDINATE};0;0',
        ],
    )
    # '2025' is a yearly archive, the layout CVM uses once a year is archived.
    plgn_months(client)
    since = date(2025, 6, 10)

    before = await ingestion(client).run(fund_asset_ids_since={asset_id: since}, now=THURSDAY)

    status, error = (await attempts(db, before.execution_id))[asset_id]
    assert status == 'failure'
    assert OLD_SENIOR in error
    assert '2025' not in await coverage(db, asset_id)

    service = AssetService(uow=UnitOfWork(), cache=RedisService())
    await service.confirm_series_aliases(
        asset_id, [{'label': OLD_SENIOR, 'valid_to': date(2026, 5, 31)}]
    )
    after = await ingestion(client).run(fund_asset_ids_since={asset_id: since}, now=THURSDAY)

    assert (await attempts(db, after.execution_id))[asset_id] == ('success', None)
    assert await quotes(db, asset_id) == [
        (date(2025, 5, 30), Decimal('1.14000000')),
        (date(2025, 6, 30), Decimal('1.15000000')),
        (date(2026, 7, 31), Decimal('1.42053670')),
    ]
    # The new selection version made July count as not applied, even unchanged.
    assert fidc_path('202607') in client.downloaded()[-2:]


# ---------------------------------------------------------------------------
# Historical correction
# ---------------------------------------------------------------------------


async def test_the_weekly_sweep_picks_up_a_correction_older_than_the_routine_overlap(db, tmp_path):
    fif_class = await registry_class(db, registry_id=82, cnpj='00888897000131', kind='FIF')
    asset_id = await register(fif_class)
    client = FakeCvmClient(tmp_path)
    publish_daily(client, '202605', [f'{FIF};;2026-05-04;10.00'])
    publish_daily(client, '202606', [f'{FIF};;2026-06-01;10.10'])
    publish_daily(client, '202607', [f'{FIF};;2026-07-01;10.20'])
    publish_daily(client, '202608', [f'{FIF};;2026-08-03;10.30'])
    publish_daily(client, '202609', [f'{FIF};;2026-09-16;10.40'])
    since = date(2026, 5, 4)
    await ingestion(client).run(fund_asset_ids_since={asset_id: since}, now=THURSDAY)

    # CVM re-publishes June with a corrected value.
    publish_daily(client, '202606', [f'{FIF};;2026-06-01;10.15'])
    routine = await ingestion(client).run(fund_asset_ids_since={asset_id: since}, now=THURSDAY)
    assert routine.changed == {}
    assert (date(2026, 6, 1), Decimal('10.10000000')) in await quotes(db, asset_id)

    sweep = await ingestion(client).run(fund_asset_ids_since={asset_id: since}, now=TUESDAY)
    execution = await db.get(DataIngestionExecution, sweep.execution_id)
    assert execution.parameters['mode'] == 'revision'
    assert sweep.changed == {asset_id: date(2026, 6, 1)}
    assert (date(2026, 6, 1), Decimal('10.15000000')) in await quotes(db, asset_id)
    revised = {f['period']: f['status'] for f in execution.parameters['files'] if 'reasons' in f}
    assert revised['202606'] == 'downloaded'
    assert revised['202607'] == 'not_modified'

    # The sweep succeeded, so the rest of the week is routine again.
    after = await ingestion(client).run(fund_asset_ids_since={asset_id: since}, now=TUESDAY)
    assert (await db.get(DataIngestionExecution, after.execution_id)).parameters['mode'] == (
        'routine'
    )


async def test_an_unchanged_file_with_no_rows_for_the_fund_is_skipped_and_a_new_version_is_read(
    db, tmp_path
):
    fif_class = await registry_class(db, registry_id=82, cnpj='00888897000131', kind='FIF')
    asset_id = await register(fif_class)
    client = FakeCvmClient(tmp_path)
    publish_daily(client, '202608', ['11.111.111/0001-11;;2026-08-31;1'])
    publish_daily(client, '202609', [f'{FIF};;2026-09-16;10.40'])
    since = date(2026, 8, 20)

    await ingestion(client).run(fund_asset_ids_since={asset_id: since}, now=THURSDAY)
    served = len(client.downloaded())
    await ingestion(client).run(fund_asset_ids_since={asset_id: since}, now=THURSDAY)
    assert len(client.downloaded()) == served
    assert await coverage(db, asset_id) == ['202608', '202609']

    publish_daily(
        client, '202608', ['11.111.111/0001-11;;2026-08-31;1', f'{FIF};;2026-08-31;10.35']
    )
    run = await ingestion(client).run(fund_asset_ids_since={asset_id: since}, now=THURSDAY)
    assert run.changed == {asset_id: date(2026, 8, 31)}
    assert client.downloaded()[served:] == [daily_path('202608')]


# ---------------------------------------------------------------------------
# Pension fund, end to end
# ---------------------------------------------------------------------------


async def test_a_pension_subclass_is_registered_ingested_and_consolidated(db, factory, tmp_path):
    """PREV files in the daily dataset under its subclass; the position prices
    the purchase day from the value filed before it and follows the later one."""
    from datetime import timedelta

    from app.composition.portfolio import portfolio_consolidator_service_context

    today = date.today()
    buy, before, after = (
        today - timedelta(days=5),
        today - timedelta(days=8),
        today - timedelta(days=2),
    )
    fif_class = await registry_class(
        db, registry_id=82, cnpj='00888897000131', kind='FIF', subclasses=['RBMFN1747320951']
    )
    async with UnitOfWork() as uow:
        subclass_id = (await uow.fund_registry.list_subclasses(fif_class))[0].id
    service = AssetService(uow=UnitOfWork(), cache=RedisService())
    asset_id = (
        await service.register_fund(
            fund_registry_class_id=fif_class,
            fund_registry_subclass_id=subclass_id,
            asset_type_id=ASSET_TYPE.PREV,
        )
    )['id']
    portfolio_id = await factory.portfolio()
    broker_id = await factory.broker()
    for day in (before, buy, after, today):
        await factory.usd_brl_rate(on=day)
    await factory.transaction(
        portfolio_id=portfolio_id,
        asset_id=asset_id,
        broker_id=broker_id,
        quantity=1000,
        price=73.0,
        on=buy,
    )
    client = FakeCvmClient(tmp_path)
    by_month: dict[str, list[str]] = {}
    for day, value in ((before, '72.50'), (after, '74.00')):
        by_month.setdefault(f'{day:%Y%m}', []).extend([
            f'{FIF};RBMFN1747320951;{day:%Y-%m-%d};{value}',
            f'{FIF};;{day:%Y-%m-%d};10.00',
        ])
    for period, rows in sorted(by_month.items()):
        publish_daily(client, period, rows)

    run = await ingestion(client).run(fund_asset_ids_since={asset_id: buy}, now=datetime.now(UTC))
    async with portfolio_consolidator_service_context() as consolidator:
        await consolidator.recalculate_position_asset(portfolio_id, asset_id)

    assert run.changed == {asset_id: before}
    rows = (
        await db.execute(
            text(
                'SELECT date, price FROM portfolio.position '
                'WHERE portfolio_id = :p AND asset_id = :a ORDER BY date'
            ),
            {'p': portfolio_id, 'a': asset_id},
        )
    ).all()
    prices = {row.date: row.price for row in rows}
    assert min(prices) == buy
    assert prices[buy] == 72.50
    assert prices[after] == 74.00
    assert prices[today] == 74.00


async def test_first_fidc_trade_is_listed_and_task_imports_before_consolidating(
    db, factory, tmp_path, client, monkeypatch
):
    from contextlib import asynccontextmanager
    from unittest.mock import Mock

    from app.modules.portfolio.api.transaction import router as transaction_router
    from app.modules.portfolio.tasks import recalculate_asset_position as task

    asset_id = await register(await plgn_class(db), series_label=SENIOR)
    portfolio_id = await factory.portfolio()
    broker_id = await factory.broker()
    await factory.usd_brl_rate(on=date(2026, 7, 31))
    await factory.usd_brl_rate(on=BUY)
    regulator = FakeCvmClient(tmp_path)
    plgn_months(regulator)
    dispatch = Mock()
    monkeypatch.setattr(transaction_router, 'run_task_by_name', dispatch)
    monkeypatch.setattr(task, 'run_task', Mock())

    @asynccontextmanager
    async def ingestion_context():
        yield ingestion(regulator)

    monkeypatch.setattr(task, 'fund_share_value_ingestion_runner_context', ingestion_context)
    response = await client.post(
        '/portfolio/transaction',
        json={
            'portfolio_id': portfolio_id,
            'asset_id': asset_id,
            'broker_id': broker_id,
            'date': BUY.isoformat(),
            'quantity': 100,
            'price': 1.5,
            'currency': 'BRL',
        },
    )
    assert response.status_code == 200, response.text
    dispatch.assert_called_once_with('recalculate_asset_position', portfolio_id, asset_id)
    assert await quotes(db, asset_id) == []

    # Listing a committed trade does not depend on the background position.
    response = await client.get('/portfolio/transaction', params={'portfolio_id': portfolio_id})
    rows = response.json()
    assert response.status_code == 200
    assert len(rows) == 1
    assert rows[0]['asset_id'] == asset_id
    assert rows[0]['ticker'] is None
    assert rows[0]['name']

    await task.recalculate_position_asset.run.__wrapped__(portfolio_id, asset_id)

    assert await quotes(db, asset_id)
    positions = await db.scalar(
        text('SELECT count(*) FROM portfolio.position WHERE portfolio_id = :p AND asset_id = :a'),
        {'p': portfolio_id, 'a': asset_id},
    )
    assert positions > 0

    # A new trade still needs consolidation when the regulator files are unchanged.
    response = await client.post(
        '/portfolio/transaction',
        json={
            'portfolio_id': portfolio_id,
            'asset_id': asset_id,
            'broker_id': broker_id,
            'date': BUY.isoformat(),
            'quantity': 50,
            'price': 1.5,
            'currency': 'BRL',
        },
    )
    assert response.status_code == 200, response.text
    await task.recalculate_position_asset.run.__wrapped__(portfolio_id, asset_id)
    quantity = await db.scalar(
        text(
            'SELECT quantity FROM portfolio.position WHERE portfolio_id = :p AND asset_id = :a '
            'ORDER BY date DESC LIMIT 1'
        ),
        {'p': portfolio_id, 'a': asset_id},
    )
    assert quantity == 150


async def test_a_registry_link_to_another_cnpj_cannot_price_the_fund(db, tmp_path):
    asset_id = await register(await plgn_class(db), series_label=SENIOR)
    await db.execute(
        text('UPDATE asset.fund SET legal_id = :cnpj WHERE asset_id = :asset_id'),
        {'cnpj': '55048271000109', 'asset_id': asset_id},
    )
    await db.commit()
    regulator = FakeCvmClient(tmp_path)
    plgn_months(regulator)

    result = await ingestion(regulator).run(fund_asset_ids_since={asset_id: BUY}, now=THURSDAY)

    assert result.succeeded == set()
    assert 'CNPJ differs' in result.errors[asset_id]
    assert result.changed == {}
    assert await quotes(db, asset_id) == []
