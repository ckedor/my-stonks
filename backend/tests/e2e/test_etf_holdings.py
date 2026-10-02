"""The ETF holdings run and the market-page reads, against Postgres.

The registry is written first by its own run, with the regulators faked, so the
holdings run finds the fund the way it will in production: through the link
from the asset to its registered class.
"""

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select, text

from app.infra.db.unit_of_work import UnitOfWork
from app.infra.integrations.sec_client import NportFiling
from app.modules.market_data.domain.etf_registry import EtfHolding
from app.modules.market_data.domain.ingestion import DataIngestionAttempt, DataIngestionExecution
from app.modules.market_data.service.data_ingestion_service import DataIngestionService
from app.modules.market_data.service.etf_holdings_ingestion_service import (
    EtfHoldingsIngestionService,
)
from app.modules.market_data.service.etf_service import EtfReadService
from tests.e2e.test_etf_registry_ingestion import CSPX_ISIN, FakeEsma, build_service, etf_asset
from tests.fixtures.etf_manager_files import EXUS_ISIN, constituents_xlsx
from tests.fixtures.etf_registry import NPORT_DOCUMENT

IVV_FILING = NportFiling(
    cik=1100663, accession='000207169126019760', period=date(2026, 6, 30), filed=date(2026, 8, 25)
)


@dataclass
class FakeNport:
    documents_read: list = field(default_factory=list)

    async def latest_nport(self, series_id):
        return IVV_FILING if series_id == 'S000004310' else None

    async def nport_document(self, filing):
        self.documents_read.append(filing.accession)
        return NPORT_DOCUMENT

    async def close(self):
        pass


@dataclass
class FakeFigi:
    asked: list = field(default_factory=list)

    async def us_tickers(self, isins):
        self.asked.append(sorted(isins))
        # Apple trades as AAPL; the future has no ISIN and is never asked.
        return {isin: {'AAPL'} for isin in isins if isin == 'US0378331005'}

    async def close(self):
        pass


@dataclass
class FakeDws:
    asked: list = field(default_factory=list)

    async def constituents(self, isin):
        self.asked.append(isin)
        return constituents_xlsx()

    async def close(self):
        pass


def holdings_service(sec, figi=None, dws=None) -> EtfHoldingsIngestionService:
    return EtfHoldingsIngestionService(
        uow_factory=UnitOfWork,
        ingestion_service=DataIngestionService(uow_factory=UnitOfWork),
        sec=sec,
        figi=figi or FakeFigi(),
        dws=dws or FakeDws(),
    )


async def attempts(db, execution_id):
    result = await db.execute(
        select(DataIngestionAttempt).where(DataIngestionAttempt.execution_id == execution_id)
    )
    return list(result.scalars().all())


async def test_holdings_are_read_once_per_filing_and_served_largest_first(db, tmp_path):
    ivv = await etf_asset(db, 'IVV')
    london = await etf_asset(db, 'SXR8', exchange='LSE', isin=CSPX_ISIN)
    # A stock the app registers with its ISIN: the holding points at it.
    nvidia = await db.scalar(
        text("""
            INSERT INTO asset.asset (ticker, name, asset_type_id, isin)
            VALUES ('NVDA', 'NVIDIA', 4, 'US67066G1040')
            RETURNING id
        """)
    )
    # A stock registered the way American stocks are: by ticker, with no ISIN.
    apple = await db.scalar(
        text("""
            INSERT INTO asset.asset (ticker, name, asset_type_id, exchange_id)
            VALUES ('AAPL', 'Apple', 4, (SELECT id FROM asset.exchange WHERE code = 'NASDAQ'))
            RETURNING id
        """)
    )
    await build_service(tmp_path).run()

    sec = FakeNport()
    figi = FakeFigi()
    first = await holdings_service(sec, figi).run(asset_ids=[ivv, london])
    second = await holdings_service(sec, figi).run(asset_ids=[ivv, london])

    # The second run found the same filing already applied and read nothing.
    assert sec.documents_read == ['000207169126019760']
    again = {attempt.item_label: attempt for attempt in await attempts(db, second)}
    assert again['IVV'].parameters['status'] == 'not_modified'
    # Only Apple was asked for: NVIDIA already carried its ISIN, and once
    # Apple got its own there was nothing left to ask the second time.
    assert figi.asked == [['US0378331005']]
    assert await db.scalar(text('SELECT isin FROM asset.asset WHERE id = :id'), {'id': apple}) == (
        'US0378331005'
    )
    execution = await db.get(DataIngestionExecution, first)
    assert execution.status == 'success'
    assert execution.parameters['without_source'] == ['SXR8']

    page = await EtfReadService(UnitOfWork()).get_holdings(asset_id=ivv, page=1, page_size=2)
    assert (page['total'], page['report_date']) == (3, date(2026, 6, 30))
    assert [(item['rank'], item['name']) for item in page['items']] == [
        (1, 'NVIDIA Corp.'),
        (2, 'Apple, Inc.'),
    ]
    assert page['items'][0]['asset_id'] == nvidia
    assert page['items'][1]['asset_id'] == apple
    last = await EtfReadService(UnitOfWork()).get_holdings(asset_id=ivv, page=2, page_size=2)
    assert [(item['rank'], item['name']) for item in last['items']] == [(3, 'S&P 500 E-Mini Index')]

    profile = await EtfReadService(UnitOfWork()).get_profile(asset_id=ivv)
    assert profile['registry'] == 'sec'
    assert profile['fund']['managers'][0]['name'] == 'BlackRock Fund Advisors'
    assert profile['holdings']['holdings_count'] == 3
    ucits = await EtfReadService(UnitOfWork()).get_profile(asset_id=london)
    assert (ucits['registry'], ucits['holdings_available']) == ('esma', False)
    assert ucits['share_class']['distribution_policy'] == 'accumulating'


async def test_an_amended_filing_replaces_the_report_for_its_date(db, tmp_path):
    ivv = await etf_asset(db, 'IVV')
    await build_service(tmp_path).run()
    await holdings_service(FakeNport()).run(asset_ids=[ivv])

    amended = FakeNport()

    async def later(series_id):
        return NportFiling(
            cik=1100663,
            accession='000207169126099999',
            period=date(2026, 6, 30),
            filed=date(2026, 9, 1),
        )

    amended.latest_nport = later
    await holdings_service(amended).run(asset_ids=[ivv])

    count = await db.scalar(select(text('count(*)')).select_from(EtfHolding.__table__))
    assert count == 3


#: A sub-fund LEI with valid check digits, for EXUS's place in FIRDS.
EXUS_LEI = '549300EXUSTESTFUND24'


async def test_a_ucits_etf_is_read_from_its_managers_file_once_per_date(db, tmp_path):
    # Both registered by the migrations, with the ISIN that links them.
    exus = await db.scalar(text("SELECT id FROM asset.asset WHERE ticker = 'EXUS.L'"))
    cspx = await db.scalar(text("SELECT id FROM asset.asset WHERE ticker = 'CSPX.L'"))
    # A holding the app already registers by ISIN is tied to it as written.
    asml = await db.scalar(
        text("""
            INSERT INTO asset.asset (ticker, name, asset_type_id, isin)
            VALUES ('ASML', 'ASML', 4, 'NL0010273215')
            RETURNING id
        """)
    )
    esma = FakeEsma()
    esma.documents.append({
        'isin': EXUS_ISIN,
        'lei': EXUS_LEI,
        'gnr_full_name': 'Xtrackers MSCI World ex USA UCITS ETF 1C',
        'gnr_cfi_code': 'CEOGES',
        'gnr_notional_curr_code': 'USD',
    })
    await build_service(tmp_path, esma=esma).run()

    dws = FakeDws()
    figi = FakeFigi()
    first = await holdings_service(FakeNport(), figi, dws).run(asset_ids=[exus, cspx])
    second = await holdings_service(FakeNport(), figi, dws).run(asset_ids=[exus, cspx])

    # Read both times — the file's date is only known once it is read — and
    # written once.
    assert dws.asked == [EXUS_ISIN, EXUS_ISIN]
    once = {attempt.item_label: attempt for attempt in await attempts(db, first)}
    again = {attempt.item_label: attempt for attempt in await attempts(db, second)}
    assert (once['EXUS.L'].source, once['EXUS.L'].parameters['status']) == ('dws', 'downloaded')
    assert again['EXUS.L'].parameters['status'] == 'not_modified'
    # A UCITS fund's holdings are not asked of OpenFIGI, and a UCITS class
    # whose manager's file is not read still has no source.
    assert figi.asked == []
    execution = await db.get(DataIngestionExecution, first)
    assert execution.status == 'success'
    assert execution.parameters['without_source'] == ['CSPX.L']

    page = await EtfReadService(UnitOfWork()).get_holdings(asset_id=exus, page=1, page_size=10)
    assert (page['source'], page['report_date'], page['total']) == (
        'dws',
        date(2026, 9, 30),
        3,
    )
    assert [item['name'] for item in page['items']] == [
        'TOYOTA MOTOR CORP',
        'ASML HOLDING NV',
        'NESTLE SA',
    ]
    assert page['items'][1]['asset_id'] == asml

    profile = await EtfReadService(UnitOfWork()).get_profile(asset_id=exus)
    assert (profile['holdings_available'], profile['holdings']['source']) == (True, 'dws')
    other = await EtfReadService(UnitOfWork()).get_profile(asset_id=cspx)
    assert other['holdings_available'] is False
