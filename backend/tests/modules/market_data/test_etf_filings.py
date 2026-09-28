"""The guards of the ETF registry, against what the regulators' files carry.

Every case below is a row that exists in the published files, not a scenario
imagined for the test: filers miss the ETF box, give 27 series one LEI, misfile
a feeder as a sub-fund, and publish LEIs that fail their own check digits.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.infra.exceptions import IntegrationBadResponse
from app.modules.market_data.adapters.etf_filings import (
    current_tickers,
    firds_class,
    lei_entity,
    read_fund_relationships,
    read_ncen_document,
    read_ncen_etfs,
    read_nport_document,
)
from app.modules.market_data.domain.etf_registry import (
    DistributionPolicy,
    distribution_policy_from_cfi,
    is_isin,
    is_lei,
)
from tests.fixtures.etf_registry import (
    BFA_LEI,
    ISHARES_TRUST_LEI,
    IVV_LEI,
    NCEN_DOCUMENT,
    NPORT_DOCUMENT,
    filing,
    fund,
    merge,
    ncen_zip,
    relationships_zip,
)

pytestmark = pytest.mark.unit

# --- identifiers --------------------------------------------------------------


def test_isin_and_lei_are_checked_by_their_check_digits():
    assert is_isin('IE00B5BMR087')  # CSPX
    assert is_isin('US0378331005')  # Apple
    assert not is_isin('IE00B5BMR086')
    assert not is_isin('IE00B5BMR08')
    assert is_lei(IVV_LEI)
    assert not is_lei('5493007M4YMN8XL48C15')
    # What Direxion files for TYO: the right shape, the wrong check digits.
    assert not is_lei('77IOI17PEDG6547SGI25')


@pytest.mark.parametrize(
    ('cfi', 'policy'),
    [
        ('CEOGES', DistributionPolicy.ACCUMULATING),  # VWRA
        ('CEOIES', DistributionPolicy.DISTRIBUTING),  # VWRL, the same fund
        ('CEOJES', DistributionPolicy.MIXED),
        ('CEXXXU', None),  # an Australian ETF that states nothing
        ('ESVUFR', None),  # a share, not an ETF
        (None, None),
    ],
)
def test_distribution_policy_is_read_from_the_cfi_code(cfi, policy):
    assert distribution_policy_from_cfi(cfi) == policy


# --- N-CEN data sets ----------------------------------------------------------


def test_an_etf_is_read_with_its_trust_its_adviser_and_its_classes(tmp_path):
    tables = merge(
        filing('A1', period='31-MAR-2026', filed='10-JUN-2026'),
        {
            'FUND_REPORTED_INFO.tsv': [
                fund('A1', 'F1', 'S000004310', 'iShares Core S&P 500 ETF', index='Y'),
            ],
            'ADVISER.tsv': [
                {
                    'FUND_ID': 'F1',
                    'ADVISER_TYPE': 'Advisor',
                    'ADVISER_NAME': 'BlackRock Fund Advisors',
                    'ADVISER_LEI': BFA_LEI,
                    'COUNTRY': 'US',
                },
                # Filed twice under two spellings: the LEI makes it one adviser.
                {
                    'FUND_ID': 'F1',
                    'ADVISER_TYPE': 'Advisor',
                    'ADVISER_NAME': 'BLACKROCK FUND ADVISORS',
                    'ADVISER_LEI': BFA_LEI,
                    'COUNTRY': 'US',
                },
                # A sub-adviser runs money under the adviser; it is not one.
                {
                    'FUND_ID': 'F1',
                    'ADVISER_TYPE': 'Subadvisor',
                    'ADVISER_NAME': 'Somebody Else',
                    'ADVISER_LEI': '549300I8X5UWMSXOJ371',
                    'COUNTRY': 'US',
                },
            ],
            'SHARES_OUTSTANDING.tsv': [
                {
                    'FUND_ID': 'F1',
                    'CLASS_NAME': 'iShares Core S&P 500 ETF',
                    'CLASS_ID': 'C000012040',
                    'TICKER': 'ivv',
                }
            ],
        },
    )

    etfs = read_ncen_etfs([ncen_zip(tmp_path / 'q.zip', tables)])

    ivv = etfs['S000004310']
    assert (ivv.lei, ivv.tracks_index, ivv.leveraged_or_inverse) == (IVV_LEI, True, False)
    assert (ivv.trust.lei, ivv.trust.name) == (ISHARES_TRUST_LEI, 'iShares Trust')
    assert [adviser.lei for adviser in ivv.advisers] == [BFA_LEI]
    assert [(c.class_id, c.ticker) for c in ivv.classes] == [('C000012040', 'IVV')]


def test_an_open_end_fund_on_an_exchange_is_an_etf_even_without_the_box(tmp_path):
    """Global X filed its Interest Rate Hedge ETF with no box checked."""
    tables = merge(
        filing('A1', period='31-MAR-2026', filed='10-JUN-2026'),
        filing('B1', period='31-MAR-2026', filed='10-JUN-2026', form='N-2'),
        {
            'FUND_REPORTED_INFO.tsv': [
                fund('A1', 'F1', 'S000076384', 'Global X Interest Rate Hedge ETF', etf=''),
                fund('A1', 'F2', 'S000000001', 'A mutual fund', etf='', lei=BFA_LEI),
                fund('B1', 'F3', 'S000000002', 'A closed-end fund', etf=''),
            ],
            'SECURITY_EXCHANGE.tsv': [
                {'FUND_ID': 'F1', 'FUND_EXCHANGE': 'XNAS'},
                # Closed-end funds trade on exchanges too, and are not ETFs.
                {'FUND_ID': 'F3', 'FUND_EXCHANGE': 'XNYS'},
            ],
        },
    )

    etfs = read_ncen_etfs([ncen_zip(tmp_path / 'q.zip', tables)])

    assert set(etfs) == {'S000076384'}


def test_a_later_filing_wins_and_an_invalid_lei_keeps_the_series(tmp_path):
    older = merge(
        filing('A1', period='31-DEC-2024', filed='10-MAR-2025'),
        {'FUND_REPORTED_INFO.tsv': [fund('A1', 'F1', 'S000025256', 'Old name')]},
    )
    newer = merge(
        filing('A2', period='31-DEC-2025', filed='10-MAR-2026'),
        {
            'FUND_REPORTED_INFO.tsv': [
                fund(
                    'A2',
                    'F1',
                    'S000025256',
                    'Direxion Daily 7-10 Year Treasury Bear 3X Shares',
                    lei='77IOI17PEDG6547SGI25',
                    inverse='Y',
                )
            ]
        },
    )

    etfs = read_ncen_etfs([
        ncen_zip(tmp_path / 'new.zip', newer),
        ncen_zip(tmp_path / 'old.zip', older),
    ])

    tyo = etfs['S000025256']
    assert tyo.name == 'Direxion Daily 7-10 Year Treasury Bear 3X Shares'
    assert tyo.lei is None
    assert tyo.leveraged_or_inverse is True


def test_a_missing_column_fails_the_file(tmp_path):
    path = ncen_zip(tmp_path / 'q.zip', {}, drop_column='IS_ETF')

    with pytest.raises(IntegrationBadResponse, match='IS_ETF'):
        read_ncen_etfs([path])


def test_current_tickers_group_classes_by_series():
    rows = [
        [1100663, 'S000004310', 'C000012040', 'IVV'],
        [1378872, 'S000069448', 'C000221604', 'qqqm'],
        [1, '', 'C1', 'NOSERIES'],
    ]

    assert current_tickers(rows) == {
        'S000004310': {'C000012040': 'IVV'},
        'S000069448': {'C000221604': 'QQQM'},
    }


# --- one N-CEN document from EDGAR --------------------------------------------


def test_an_ncen_document_reads_like_the_data_sets():
    etfs = read_ncen_document(NCEN_DOCUMENT, filed=date(2025, 12, 15))

    assert set(etfs) == {'S000064108', 'S000076384'}
    cnbs = etfs['S000064108']
    assert (cnbs.tracks_index, cnbs.leveraged_or_inverse, cnbs.fund_of_funds) == (
        True,
        True,
        False,
    )
    assert cnbs.trust.name == 'Amplify ETF Trust'
    # An adviser filed with "N/A" for its LEI cannot become a legal entity.
    assert [adviser.lei for adviser in cnbs.advisers] == [BFA_LEI]
    assert [(c.class_id, c.ticker) for c in cnbs.classes] == [('C000207255', 'CNBS')]
    assert cnbs.filed == (date(2025, 9, 30), date(2025, 12, 15))
    assert etfs['S000076384'].lei is None


def test_a_document_that_is_not_xml_is_a_bad_response():
    with pytest.raises(IntegrationBadResponse):
        read_ncen_document(b'<html>', filed=date(2025, 1, 1))


# --- FIRDS and GLEIF ----------------------------------------------------------


def test_a_firds_document_becomes_a_class_only_with_valid_identifiers():
    document = {
        'isin': 'IE00BK5BQT80',
        'lei': 'EEXSPYGY7X8YAH8ZJF49',
        'gnr_full_name': 'Vanguard FTSE All-World UCITS ETFS',
        'gnr_cfi_code': 'CEOGES',
        'gnr_notional_curr_code': 'USD',
    }

    vwra = firds_class(document)

    assert (vwra.isin, vwra.currency, vwra.distribution_policy) == (
        'IE00BK5BQT80',
        'USD',
        DistributionPolicy.ACCUMULATING,
    )
    assert firds_class({**document, 'isin': 'IE00BK5BQT81'}) is None
    assert firds_class({**document, 'lei': None}) is None


def test_a_sub_fund_stays_a_fund_when_a_feeder_misfiles_itself_under_it(tmp_path):
    """GLEIF has a feeder filed as a sub-fund of iShares Core MSCI EM IMI."""
    eimi, ishares_plc, feeder, blackrock = (
        '549300HAPVPBRLCT6I96',
        '549300YDM1GFZR5B4U80',
        '378900525741E0D3BB51',
        '5493004330BCAPB3GT42',
    )
    path = relationships_zip(
        tmp_path / 'rr.zip',
        [
            (eimi, ishares_plc, 'IS_SUBFUND_OF'),
            (eimi, blackrock, 'IS_FUND-MANAGED_BY'),
            (feeder, eimi, 'IS_SUBFUND_OF'),
        ],
    )

    relationships = read_fund_relationships(path, {eimi})

    assert relationships.umbrellas == {eimi: ishares_plc}
    assert relationships.managers[eimi] == [blackrock]
    assert relationships.umbrella_leis == {ishares_plc}


def test_a_lei_record_falls_back_to_the_legal_address_for_its_country():
    record = {
        'id': BFA_LEI,
        'attributes': {
            'entity': {
                'legalName': {'name': 'BlackRock Fund Advisors'},
                'jurisdiction': None,
                'legalAddress': {'country': 'US'},
            }
        },
    }

    assert lei_entity(record).country == 'US'
    record['attributes']['entity']['legalAddress'] = {}
    assert lei_entity(record) is None


# --- N-PORT -------------------------------------------------------------------


def test_an_nport_document_gives_every_holding_with_its_weight_as_a_ratio():
    report = read_nport_document(NPORT_DOCUMENT)

    assert (report.series_id, report.report_date) == ('S000004310', date(2026, 6, 30))
    assert report.net_assets == Decimal('888128937468.17')
    by_name = {holding['name']: holding for holding in report.holdings}
    nvidia = by_name['NVIDIA Corp.']
    # Filed as percentage points; the domain keeps proportions as ratios.
    assert nvidia['weight'] == Decimal('0.0750593247848')
    assert (nvidia['isin'], nvidia['cusip'], nvidia['asset_category']) == (
        'US67066G1040',
        '67066G104',
        'EC',
    )
    # A future has no issuer: "N/A" is not a name, the title is.
    future = by_name['S&P 500 E-Mini Index']
    assert (future['isin'], future['lei'], future['cusip']) == (None, None, None)
