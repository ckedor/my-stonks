from sqlalchemy import select

from app.infra.db.unit_of_work import UnitOfWork
from app.infra.integrations.cvm_client import REGISTRY_PATH, TERMS_PATH
from app.modules.market_data.domain.fund_registry import (
    FundRegistry,
    FundRegistryClass,
    FundRegistrySubclass,
)
from app.modules.market_data.domain.ingestion import DataIngestionExecution
from app.modules.market_data.service.data_ingestion_service import DataIngestionService
from app.modules.market_data.service.fund_registry_ingestion_service import (
    FundRegistryIngestionService,
)
from tests.fixtures.cvm import (
    PLGN_CLASS,
    PLGN_FUND,
    TERMS_HEADER,
    FakeCvmClient,
    csv_bytes,
    registry_zip,
)

MULTI_MANAGER_FUND = (
    '627;16671412000193;1;2012-11-16;2012-11-01;FIF;TELLUS FIF;;Em Funcionamento Normal;;;;;;;;'
    '1;ADMIN;PJ;{document};{name}'
)
MULTI_CLASS = (
    '627;700;16671412000193;1;2012-11-16;;;Classes de Cotas de Fundos FIF;TELLUS CLASSE;'
    'Em Funcionamento Normal;;Renda Fixa;;;Renda Fixa Duração Livre;S;;;;Aberto;N;Público Geral;'
    '1000.00;2026-08-31;;;;;;'
)
SUBCLASS = (
    '700;ABCDE1747320951;1;2025-05-15;2025-05-14;SUBCLASSE PREV;Em Funcionamento Normal;;Aberto;N;'
    'Público Geral;S;N;N'
)


def registry_body(*, plgn_status='Em Funcionamento Normal'):
    return registry_zip(
        funds=[
            PLGN_FUND.replace('Em Funcionamento Normal', plgn_status),
            MULTI_MANAGER_FUND.format(document='11111111000111', name='GESTORA A'),
            MULTI_MANAGER_FUND.format(document='22222222000122', name='GESTORA B'),
        ],
        # The duplicate class row is in the published file too.
        classes=[PLGN_CLASS, MULTI_CLASS, MULTI_CLASS],
        subclasses=[SUBCLASS],
    )


TERMS_BODY = csv_bytes(
    TERMS_HEADER,
    'CLASSES - FIF;16.671.412/0001-93;TELLUS;2026-02-26;ABERTO;0.500000;20.000000000000;CDI;'
    '1000.00;1;3',
    # A CNPJ with no registered class: nothing to write, and not an error.
    'FI;99.999.999/0001-99;OUTRO;2016-06-21;ABERTO;0.300000;;;1.00;0;0',
)


def build_service(client) -> FundRegistryIngestionService:
    return FundRegistryIngestionService(
        uow_factory=UnitOfWork,
        ingestion_service=DataIngestionService(uow_factory=UnitOfWork),
        client=client,
    )


async def attempts_of(db, execution_id):
    from app.modules.market_data.domain.ingestion import DataIngestionAttempt

    result = await db.execute(
        select(DataIngestionAttempt)
        .where(DataIngestionAttempt.execution_id == execution_id)
        .order_by(DataIngestionAttempt.item_id)
    )
    return list(result.scalars().all())


async def test_registry_files_are_upserted_idempotently_and_terms_reach_their_class(db, tmp_path):
    client = FakeCvmClient(tmp_path)
    client.publish(REGISTRY_PATH, registry_body())
    client.publish(TERMS_PATH, TERMS_BODY)

    first = await build_service(client).run()
    client.publish(REGISTRY_PATH, registry_body(plgn_status='Em Liquidação'))
    second = await build_service(client).run(force_full_history=True)

    funds = (await db.execute(select(FundRegistry).order_by(FundRegistry.registry_id))).scalars()
    funds = list(funds)
    assert [fund.registry_id for fund in funds] == [627, 13812]
    assert funds[0].manager_name == 'GESTORA A / GESTORA B'
    assert funds[0].manager_document == '11111111000111 / 22222222000122'
    assert funds[1].status == 'Em Liquidação'
    assert funds[1].administrator_cnpj == '59281253000123'

    classes = list(
        (
            await db.execute(select(FundRegistryClass).order_by(FundRegistryClass.registry_id))
        ).scalars()
    )
    assert [item.registry_id for item in classes] == [700, 31847]
    tellus, plgn = classes
    assert (tellus.admin_fee, tellus.minimum_investment, tellus.redemption_payment_days) == (
        0.5,
        1000,
        3,
    )
    assert tellus.performance_benchmark == 'CDI'
    assert tellus.long_term_taxation is True
    assert tellus.anbima_classification == 'Renda Fixa Duração Livre'
    assert plgn.admin_fee is None
    assert plgn.open_ended is True

    subclass = (await db.execute(select(FundRegistrySubclass))).scalars().one()
    assert (subclass.code, subclass.pension, subclass.fund_registry_class_id) == (
        'ABCDE1747320951',
        True,
        tellus.id,
    )

    for execution_id in (first, second):
        execution = await db.get(DataIngestionExecution, execution_id)
        assert execution.status == 'success'
        attempts = await attempts_of(db, execution_id)
        assert [attempt.status for attempt in attempts] == ['success', 'success']
    registry_attempt = (await attempts_of(db, first))[0]
    assert registry_attempt.parameters['status'] == 'downloaded'
    # three funds rows merge into two, three class rows into two, one subclass
    assert registry_attempt.upserted_rows == 2 + 2 + 1


async def test_an_unchanged_file_is_recorded_as_not_modified(db, tmp_path):
    client = FakeCvmClient(tmp_path)
    client.publish(REGISTRY_PATH, registry_body())
    client.publish(TERMS_PATH, TERMS_BODY)

    await build_service(client).run()
    execution_id = await build_service(client).run()

    attempts = await attempts_of(db, execution_id)
    assert [attempt.parameters['status'] for attempt in attempts] == [
        'not_modified',
        'not_modified',
    ]
    assert [attempt.upserted_rows for attempt in attempts] == [0, 0]
    assert client.requests[-2][1] is not None
    assert list(tmp_path.iterdir()) == []


async def test_a_file_that_fails_part_way_writes_nothing_and_keeps_no_validators(db, tmp_path):
    client = FakeCvmClient(tmp_path)
    # A subclass pointing at a class the file does not have fails the file
    # after funds and classes were already written in the same transaction.
    client.publish(
        REGISTRY_PATH,
        registry_zip(funds=[PLGN_FUND], classes=[PLGN_CLASS], subclasses=[SUBCLASS]),
    )
    client.publish(TERMS_PATH, TERMS_BODY)

    execution_id = await build_service(client).run()

    attempts = await attempts_of(db, execution_id)
    assert attempts[0].status == 'failure'
    assert 'unknown class 700' in attempts[0].error
    assert (await db.execute(select(FundRegistry))).scalars().all() == []
    execution = await db.get(DataIngestionExecution, execution_id)
    assert execution.status == 'partial_success'

    client.publish(REGISTRY_PATH, registry_body())
    await build_service(client).run()
    # No validator was kept for the failed body, so the next run downloads.
    assert client.requests[-2] == (REGISTRY_PATH, None)
    assert client.requests[-1] == (TERMS_PATH, None)
    fee = await db.scalar(
        select(FundRegistryClass.admin_fee).where(FundRegistryClass.registry_id == 700)
    )
    assert fee == 0.5


async def test_unchanged_terms_are_applied_to_a_class_added_by_a_new_registry(db, tmp_path):
    client = FakeCvmClient(tmp_path)
    client.publish(
        REGISTRY_PATH, registry_zip(funds=[PLGN_FUND], classes=[PLGN_CLASS], subclasses=[])
    )
    client.publish(TERMS_PATH, TERMS_BODY)
    await build_service(client).run()

    client.publish(REGISTRY_PATH, registry_body())
    await build_service(client).run()

    assert client.requests[-1] == (TERMS_PATH, None)
    fee = await db.scalar(
        select(FundRegistryClass.admin_fee).where(FundRegistryClass.registry_id == 700)
    )
    assert fee == 0.5
    await build_service(client).run()
    assert client.requests[-1][1] is not None
