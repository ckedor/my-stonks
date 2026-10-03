"""The guards of a manager's holdings list.

A manager's API is made for its own page and nothing promises its shape, so
the reader's worth is in what it refuses: each case below is one way an answer
can look readable and be wrong, and the reader has to stop on it.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.infra.exceptions import IntegrationBadResponse
from app.infra.integrations.ishares_client import PRODUCT_IDS
from app.infra.integrations.vanguard_client import PORT_IDS
from app.modules.market_data.adapters.etf_manager_files import (
    read_dws_holdings,
    read_ishares_holdings,
    read_vanguard_holdings,
)
from app.modules.market_data.domain.etf_registry import (
    MANAGER_HOLDINGS_FILES,
    EtfHoldingSource,
    EtfRegistry,
    EtfRegistrySource,
    holdings_source,
)
from tests.fixtures.etf_manager_files import (
    CSPX_ISIN,
    DWS_COLUMNS,
    DWS_LINES,
    EXUS_ISIN,
    ISHARES_LINES,
    VANGUARD_ITEMS,
    VWRA_ISIN,
    dws_holdings,
    ishares_holdings,
    vanguard_holdings,
)

# --- DWS ----------------------------------------------------------------------


def test_a_dws_table_gives_its_source_date_and_every_line_with_its_weight_as_a_ratio():
    report = read_dws_holdings(dws_holdings())

    # Day first, from the footnote: the page is the en-GB one.
    assert report.report_date == date(2026, 10, 1)
    asml = report.holdings[0]
    assert asml == {
        'name': 'ASML HOLDING',
        'isin': 'NL0010273215',
        'ticker': None,
        'country': 'NL',
        'currency': None,
        # The unrounded sort value, not the "2.884%" label.
        'weight': Decimal('0.028835911700'),
    }
    # Cash and futures are lines too; their made-up codes are not ISINs.
    assert [(line['name'], line['isin']) for line in report.holdings[2:4]] == [
        ('SWEDISH KRONA', None),
        ('S+P/TSX 60 IX FUT DEC26', None),
    ]
    assert report.unread_countries == set()


def test_a_country_name_not_in_the_table_is_left_out_and_reported():
    lines = (*DWS_LINES[:-1], (*DWS_LINES[-1][:3], 'Atlantis', 'Equities'))

    report = read_dws_holdings(dws_holdings(lines=lines))

    assert report.holdings[-1]['country'] is None
    assert report.unread_countries == {'Atlantis'}


def test_a_dws_table_without_the_weight_column_fails_and_says_what_it_needed():
    columns = [column for column in DWS_COLUMNS if column['value'] != '% Weight']

    with pytest.raises(IntegrationBadResponse, match='% Weight'):
        read_dws_holdings(dws_holdings(columns=columns))


@pytest.mark.parametrize(
    'disclaimers',
    [(), ('<p>Source: DWS 01/10/2026</p>', '<p>Source: DWS 30/09/2026</p>')],
    ids=['no date', 'two dates'],
)
def test_a_dws_table_without_exactly_one_source_date_fails(disclaimers):
    with pytest.raises(IntegrationBadResponse, match='"Source: DWS" dates'):
        read_dws_holdings(dws_holdings(disclaimers=disclaimers))


def test_a_dws_table_cut_short_fails_instead_of_passing_for_the_whole_fund():
    with pytest.raises(IntegrationBadResponse, match='add up to'):
        read_dws_holdings(dws_holdings(lines=DWS_LINES[:2]))


# --- iShares ------------------------------------------------------------------


def test_an_ishares_component_gives_its_date_and_every_line_with_its_weight_as_a_ratio():
    report = read_ishares_holdings(ishares_holdings())

    assert report.report_date == date(2026, 10, 1)
    assert report.holdings[0] == {
        'name': 'NVIDIA',
        'isin': 'US67066G1040',
        'ticker': 'NVDA',
        'country': 'US',
        'currency': 'USD',
        'weight': Decimal('0.0843983'),
    }
    future = report.holdings[3]
    assert (future['isin'], future['country'], future['weight']) == (None, None, Decimal(0))


def test_an_ishares_component_without_the_isin_column_still_reads():
    report = read_ishares_holdings(ishares_holdings(drop=('isin',)))

    assert {line['isin'] for line in report.holdings} == {None}


def test_an_ishares_component_without_the_weight_fails():
    with pytest.raises(IntegrationBadResponse, match='holdingPercent'):
        read_ishares_holdings(ishares_holdings(drop=('holdingPercent',)))


def test_an_ishares_component_with_columns_of_different_lengths_fails():
    """Read by position, a column one value short would shift every line."""
    payload = ishares_holdings()
    points = payload['componentsByNameMap']['holdings']['containersByNameMap']['all']
    points['dataPointsByNameMap']['isin']['value'].pop()

    with pytest.raises(IntegrationBadResponse, match='uneven'):
        read_ishares_holdings(payload)


def test_an_ishares_component_without_a_readable_date_fails():
    with pytest.raises(IntegrationBadResponse, match='not a date'):
        read_ishares_holdings(ishares_holdings(as_of=0))


def test_an_ishares_component_cut_short_fails():
    with pytest.raises(IntegrationBadResponse, match='add up to'):
        read_ishares_holdings(ishares_holdings(lines=ISHARES_LINES[:2]))


def test_a_page_in_place_of_the_ishares_component_fails():
    with pytest.raises(IntegrationBadResponse, match='holdings component'):
        read_ishares_holdings({'componentsByNameMap': {}})


# --- Vanguard -----------------------------------------------------------------


def test_vanguard_pages_give_their_date_and_every_line():
    report = read_vanguard_holdings(vanguard_holdings())

    assert report.report_date == date(2026, 8, 31)
    assert report.holdings[1] == {
        'name': 'Taiwan Semiconductor Manufacturing Co Ltd',
        'isin': 'TW0002330008',
        'ticker': '2330',
        'country': 'TW',
        'currency': None,
        'weight': Decimal('0.0122803'),
    }


def test_vanguard_lines_fewer_than_counted_fail():
    """A page lost in the chain still leaves weights near the whole fund when
    it held small lines; the count is what catches it."""
    with pytest.raises(IntegrationBadResponse, match='counted 5'):
        read_vanguard_holdings(vanguard_holdings(total=5))


def test_vanguard_lines_of_two_dates_fail():
    items = (*VANGUARD_ITEMS[:-1], {**VANGUARD_ITEMS[-1], 'effectiveDate': '2026-07-31'})

    with pytest.raises(IntegrationBadResponse, match='2 dates'):
        read_vanguard_holdings(vanguard_holdings(items=items))


def test_vanguard_lines_cut_short_fail():
    with pytest.raises(IntegrationBadResponse, match='add up to'):
        read_vanguard_holdings(vanguard_holdings(items=VANGUARD_ITEMS[:2]))


# --- which classes are read ---------------------------------------------------


def test_a_holdings_source_is_the_sec_filing_or_a_manager_list_named_by_isin():
    american = EtfRegistry(source=EtfRegistrySource.SEC, name='IVV', domicile='US')
    ucits = EtfRegistry(source=EtfRegistrySource.ESMA, name='EXUS', domicile='IE')

    assert holdings_source(american, None) == EtfHoldingSource.SEC_NPORT
    assert holdings_source(ucits, EXUS_ISIN) == EtfHoldingSource.DWS
    assert holdings_source(ucits, CSPX_ISIN) == EtfHoldingSource.ISHARES
    assert holdings_source(ucits, VWRA_ISIN) == EtfHoldingSource.VANGUARD
    # SWDA: an iShares class nobody has added.
    assert holdings_source(ucits, 'IE00B4L5Y983') is None
    assert holdings_source(ucits, None) is None


@pytest.mark.parametrize(
    ('source', 'ids'),
    [(EtfHoldingSource.ISHARES, PRODUCT_IDS), (EtfHoldingSource.VANGUARD, PORT_IDS)],
    ids=['iShares', 'Vanguard'],
)
def test_every_class_of_a_manager_addressed_by_its_own_id_has_that_id(source, ids):
    """iShares and Vanguard address a fund by an id of their own, not by ISIN:
    a class added to the domain's list without its id would fail every run."""
    classes = {isin for isin, read_from in MANAGER_HOLDINGS_FILES.items() if read_from == source}

    assert classes
    assert classes <= ids.keys()
