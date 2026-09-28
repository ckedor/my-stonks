"""The ETF registry run, end to end against Postgres with the regulators faked.

What is proven here is what the unit tests cannot see: that the rows land keyed
the way the sources allow, that a second run is a no-op, that what a source
stops listing is retired rather than deleted, and that the link from an asset
goes through the ISIN for a London listing and through the ticker for an
American one — and never touches a Brazilian ETF.
"""

from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from sqlalchemy import select, text

from app.infra.db.unit_of_work import UnitOfWork
from app.infra.exceptions import IntegrationBadResponse
from app.infra.integrations.sec_client import NcenFiling
from app.modules.market_data.domain.assets import ETF, Institution
from app.modules.market_data.domain.etf_registry import EtfRegistry, EtfRegistryClass
from app.modules.market_data.domain.ingestion import DataIngestionExecution
from app.modules.market_data.service.data_ingestion_service import DataIngestionService
from app.modules.market_data.service.etf_registry_ingestion_service import (
    EtfRegistryIngestionService,
)
from tests.fixtures.etf_registry import (
    BFA_LEI,
    ISHARES_TRUST_LEI,
    IVV_LEI,
    NCEN_DOCUMENT,
    filing,
    fund,
    merge,
    ncen_zip,
    relationships_zip,
)

CSPX_ISIN = 'IE00B5BMR087'
CSPX_LEI = '5493006ESS9BM09FB892'
ISHARES_VII_LEI = '549300Q7FFITMZ2PFZ28'
BLACKROCK_IRELAND_LEI = '5493004330BCAPB3GT42'
BONDBLOXX_LEI = '549300M0XBJH5H5NJQ95'
AMPLIFY_CIK = 1633061


def adviser(fund_id, lei=BFA_LEI, name='BlackRock Fund Advisors'):
    return {
        'FUND_ID': fund_id,
        'ADVISER_TYPE': 'Advisor',
        'ADVISER_NAME': name,
        'ADVISER_LEI': lei,
        'COUNTRY': 'US',
    }


def share_class(fund_id, class_id, ticker, name=''):
    return {'FUND_ID': fund_id, 'CLASS_NAME': name, 'CLASS_ID': class_id, 'TICKER': ticker}


def ncen_tables(*, with_ivv=True):
    funds = [
        # BondBloxx files one LEI for every series of its trust.
        fund('A1', 'F2', 'S000074208', 'BondBloxx Consumer Cyclicals', lei=BONDBLOXX_LEI),
        fund('A1', 'F3', 'S000074209', 'BondBloxx Consumer Non-Cyclicals', lei=BONDBLOXX_LEI),
    ]
    advisers = []
    classes = [share_class('F2', 'C000230001', 'XHYC'), share_class('F3', 'C000230002', 'XHYD')]
    if with_ivv:
        funds.append(fund('A1', 'F1', 'S000004310', 'iShares Core S&P 500 ETF', index='Y'))
        advisers.append(adviser('F1'))
        classes.append(share_class('F1', 'C000012040', 'IVV', 'iShares Core S&P 500 ETF'))
    return merge(
        filing('A1', period='31-MAR-2026', filed='10-JUN-2026'),
        {
            'FUND_REPORTED_INFO.tsv': funds,
            'ADVISER.tsv': advisers,
            'SHARES_OUTSTANDING.tsv': classes,
        },
    )


TICKER_ROWS = [
    [1100663, 'S000004310', 'C000012040', 'IVV'],
    [1, 'S000074208', 'C000230001', 'XHYC'],
    [1, 'S000074209', 'C000230002', 'XHYD'],
    # In no data set: Amplify's N-CEN is read from EDGAR.
    [AMPLIFY_CIK, 'S000064108', 'C000207255', 'CNBS'],
]


@dataclass
class FakeSec:
    tmp_path: Path
    tables: dict = field(default_factory=ncen_tables)
    missing_identity: bool = False
    edgar_requests: list = field(default_factory=list)

    async def fund_tickers(self):
        if self.missing_identity:
            raise IntegrationBadResponse('SEC_USER_AGENT is not set', provider='sec')
        return TICKER_ROWS

    @asynccontextmanager
    async def ncen_quarter(self, year, quarter):
        # The newest quarter is not out yet, as it regularly is not.
        if (year, quarter) == (2026, 3):
            yield None
            return
        yield ncen_zip(self.tmp_path / f'{year}q{quarter}.zip', self.tables)

    async def ncen_filings(self, cik):
        self.edgar_requests.append(cik)
        if cik != AMPLIFY_CIK:
            return []
        return [NcenFiling(cik=cik, accession='000089418925016878', filed=date(2025, 12, 15))]

    async def ncen_series(self, filing):
        return {'S000064108', 'S000076384'}

    async def ncen_document(self, filing):
        return NCEN_DOCUMENT

    async def close(self):
        pass


@dataclass
class FakeEsma:
    documents: list = field(
        default_factory=lambda: [
            {
                'isin': CSPX_ISIN,
                'lei': CSPX_LEI,
                'gnr_full_name': 'iShares S&P 500 - B UCITS ETF (Acc)',
                'gnr_cfi_code': 'CEOGES',
                'gnr_notional_curr_code': 'USD',
            },
            # Filed under the umbrella: which sub-fund it is, nobody says.
            {
                'isin': 'IE00B4L5Y983',
                'lei': ISHARES_VII_LEI,
                'gnr_full_name': 'A class filed under the plc',
                'gnr_cfi_code': 'CEOGES',
                'gnr_notional_curr_code': 'USD',
            },
        ]
    )

    async def etf_classes(self):
        yield self.documents

    async def close(self):
        pass


def lei_record(lei, name, country):
    return {
        'id': lei,
        'attributes': {'entity': {'legalName': {'name': name}, 'jurisdiction': country}},
    }


@dataclass
class FakeGleif:
    tmp_path: Path

    @asynccontextmanager
    async def relationships(self):
        yield relationships_zip(
            self.tmp_path / 'rr.zip',
            [
                (CSPX_LEI, ISHARES_VII_LEI, 'IS_SUBFUND_OF'),
                (CSPX_LEI, BLACKROCK_IRELAND_LEI, 'IS_FUND-MANAGED_BY'),
            ],
        )

    async def lei_records(self, leis):
        known = {
            CSPX_LEI: lei_record(CSPX_LEI, 'iShares Core S&P 500 UCITS ETF', 'IE'),
            ISHARES_VII_LEI: lei_record(ISHARES_VII_LEI, 'iShares VII plc', 'IE'),
            BLACKROCK_IRELAND_LEI: lei_record(
                BLACKROCK_IRELAND_LEI, 'BlackRock Asset Management Ireland', 'IE'
            ),
        }
        return [known[lei] for lei in leis if lei in known]

    async def close(self):
        pass


def build_service(tmp_path, *, sec=None, esma=None):
    return EtfRegistryIngestionService(
        uow_factory=UnitOfWork,
        ingestion_service=DataIngestionService(uow_factory=UnitOfWork),
        sec=sec or FakeSec(tmp_path),
        esma=esma or FakeEsma(),
        gleif=FakeGleif(tmp_path),
    )


async def etf_asset(db, ticker, *, exchange=None, isin=None):
    return await db.scalar(
        text("""
            INSERT INTO asset.asset (ticker, name, asset_type_id, exchange_id, isin)
            VALUES (:ticker, :ticker, 1,
                    (SELECT id FROM asset.exchange WHERE code = :exchange), :isin)
            RETURNING id
        """),
        {'ticker': ticker, 'exchange': exchange, 'isin': isin},
    )


async def class_of(db, asset_id):
    etf = await db.get(ETF, asset_id)
    if etf is None or etf.etf_registry_class_id is None:
        return None
    return await db.get(EtfRegistryClass, etf.etf_registry_class_id)


async def test_the_registry_is_written_and_assets_linked_idempotently(db, tmp_path):
    ivv = await etf_asset(db, 'IVV')
    cnbs = await etf_asset(db, 'CNBS')
    london = await etf_asset(db, 'SXR8', exchange='LSE', isin=CSPX_ISIN)
    brazilian = await etf_asset(db, 'BOVA11', exchange='B3')

    first = await build_service(tmp_path).run()
    second = await build_service(tmp_path).run()

    series = {
        fund.sec_series_id: fund
        for fund in (
            await db.execute(select(EtfRegistry).where(EtfRegistry.source == 'sec'))
        ).scalars()
    }
    assert set(series) == {'S000004310', 'S000074208', 'S000074209', 'S000064108', 'S000076384'}
    assert series['S000004310'].lei == IVV_LEI
    # A LEI filed for two series identifies neither.
    assert series['S000074208'].lei is None
    assert series['S000074209'].lei is None
    assert series['S000004310'].tracks_index is True
    assert series['S000064108'].leveraged_or_inverse is True

    trust = await db.get(Institution, series['S000004310'].umbrella_institution_id)
    assert (trust.lei, trust.cnpj, trust.country) == (ISHARES_TRUST_LEI, None, 'US')
    managers = (
        await db.execute(
            text(
                'SELECT institution_id FROM asset.etf_registry_manager WHERE etf_registry_id = :id'
            ),
            {'id': series['S000004310'].id},
        )
    ).scalars()
    assert [(await db.get(Institution, manager)).lei for manager in managers] == [BFA_LEI]

    ucits = (await db.execute(select(EtfRegistry).where(EtfRegistry.lei == CSPX_LEI))).scalar_one()
    assert (ucits.source, ucits.domicile, ucits.name) == (
        'esma',
        'IE',
        'iShares Core S&P 500 UCITS ETF',
    )
    umbrella_issued = await db.scalar(
        select(EtfRegistryClass).where(EtfRegistryClass.isin == 'IE00B4L5Y983')
    )
    assert umbrella_issued is None

    assert (await class_of(db, ivv)).ticker == 'IVV'
    assert (await class_of(db, cnbs)).sec_class_id == 'C000207255'
    cspx = await class_of(db, london)
    assert (cspx.isin, cspx.distribution_policy, cspx.currency) == (
        CSPX_ISIN,
        'accumulating',
        'USD',
    )
    assert await class_of(db, brazilian) is None

    for execution_id in (first, second):
        execution = await db.get(DataIngestionExecution, execution_id)
        assert execution.status == 'success'
    link = (
        await db.execute(
            text("""
                SELECT parameters FROM market_data.data_ingestion_attempt
                WHERE execution_id = :id AND item_id = 3
            """),
            {'id': second},
        )
    ).scalar_one()
    assert link['linked']['count'] == 0
    assert link['brazilian'] >= 1


async def test_what_a_source_stops_listing_is_retired_not_deleted(db, tmp_path):
    ivv = await etf_asset(db, 'IVV')
    await build_service(tmp_path).run()

    await build_service(tmp_path, sec=FakeSec(tmp_path, tables=ncen_tables(with_ivv=False))).run()

    fund = (
        await db.execute(select(EtfRegistry).where(EtfRegistry.sec_series_id == 'S000004310'))
    ).scalar_one()
    assert fund.status == 'inactive'
    retired = await class_of(db, ivv)
    assert (retired.ticker, retired.status) == ('IVV', 'inactive')


async def test_a_failing_source_costs_its_own_step_only(db, tmp_path):
    london = await etf_asset(db, 'SXR8', exchange='LSE', isin=CSPX_ISIN)

    execution_id = await build_service(tmp_path, sec=FakeSec(tmp_path, missing_identity=True)).run()

    execution = await db.get(DataIngestionExecution, execution_id)
    assert execution.status == 'partial_success'
    assert (await class_of(db, london)).isin == CSPX_ISIN
