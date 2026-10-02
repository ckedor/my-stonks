"""The guards of a manager's holdings file.

A manager's export is made for people and nothing promises its layout, so the
reader's worth is in what it refuses: each case below is one way a file can
look readable and be wrong, and the reader has to stop on it.
"""

from datetime import date, datetime
from decimal import Decimal

import pytest

from app.infra.exceptions import IntegrationBadResponse
from app.infra.integrations.ishares_client import PRODUCTS
from app.modules.market_data.adapters.etf_manager_files import (
    read_dws_constituents,
    read_ishares_holdings,
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
    EXUS_ISIN,
    HEADER,
    ISHARES_FACTS,
    ISHARES_HEADER,
    ISHARES_LINES,
    LINES,
    constituents_xlsx,
    dated,
    holdings_csv,
)

# --- DWS ----------------------------------------------------------------------


def test_a_constituents_file_gives_its_date_and_every_line_with_its_weight_as_a_ratio():
    report = read_dws_constituents(constituents_xlsx())

    # Day first: the UK export is the one asked for.
    assert report.report_date == date(2026, 9, 30)
    # The footnotes after the table are not holdings.
    assert [holding['name'] for holding in report.holdings] == [
        'ASML HOLDING NV',
        'NESTLE SA',
        'TOYOTA MOTOR CORP',
    ]
    asml, nestle, _ = report.holdings
    assert asml == {
        'name': 'ASML HOLDING NV',
        'isin': 'NL0010273215',
        'ticker': None,
        'country': 'NL',
        'currency': 'EUR',
        'weight': Decimal('0.025'),
    }
    # A country written out is left out rather than translated by guess.
    assert nestle['country'] is None


def test_weights_written_as_ratios_or_with_a_percent_sign_read_the_same():
    as_ratio = tuple((*line[:-1], line[-1] / 100) for line in LINES)
    as_text = tuple((*line[:-1], f'{line[-1]}%') for line in LINES)

    for lines in (as_ratio, as_text):
        report = read_dws_constituents(constituents_xlsx(lines=lines))
        assert report.holdings[0]['weight'] == Decimal('0.025')


def test_a_date_cell_is_read_as_the_report_date():
    report = read_dws_constituents(constituents_xlsx(title=dated(datetime(2026, 10, 1))))

    assert report.report_date == date(2026, 10, 1)


def test_an_invalid_isin_is_kept_as_a_line_without_one():
    lines = (*LINES[:2], ('USD CASH', 'CASH', None, 'USD', None, 'Cash', 96.0))

    report = read_dws_constituents(constituents_xlsx(lines=lines))

    assert report.holdings[-1]['isin'] is None


def test_a_file_without_the_weight_column_fails_and_says_what_it_saw():
    header = tuple('Market Value' if column == 'Weighting' else column for column in HEADER)

    with pytest.raises(IntegrationBadResponse, match='no Name/ISIN/Weighting header.*Market Value'):
        read_dws_constituents(constituents_xlsx(header=header))


def test_a_file_cut_short_fails_instead_of_passing_for_the_whole_fund():
    with pytest.raises(IntegrationBadResponse, match='add up to'):
        read_dws_constituents(constituents_xlsx(lines=LINES[:2]))


@pytest.mark.parametrize(
    'title',
    [
        ('Xtrackers MSCI World ex USA UCITS ETF 1C',),
        ('Xtrackers MSCI World ex USA UCITS ETF 1C', 'As of 30/09/2026', 'Launched 2023-08-01'),
    ],
    ids=['no date', 'two dates'],
)
def test_a_file_without_exactly_one_date_fails(title):
    with pytest.raises(IntegrationBadResponse, match='dates above its header'):
        read_dws_constituents(constituents_xlsx(title=title))


def test_a_page_in_place_of_the_spreadsheet_fails():
    with pytest.raises(IntegrationBadResponse, match='not an xlsx'):
        read_dws_constituents(b'<!DOCTYPE html><html>Please accept our terms</html>')


# --- iShares ------------------------------------------------------------------


def test_an_ishares_csv_gives_its_date_and_every_line_with_its_weight_as_a_ratio():
    report = read_ishares_holdings(holdings_csv())

    assert report.report_date == date(2026, 9, 30)
    # The legal text after the table is not a holding.
    assert [holding['name'] for holding in report.holdings] == [
        'NVIDIA CORP',
        'APPLE INC',
        'MICROSOFT CORP',
        'USD CASH',
    ]
    nvidia = report.holdings[0]
    assert nvidia == {
        'name': 'NVIDIA CORP',
        'isin': None,
        'ticker': 'NVDA',
        # "United States" is written out, and left out.
        'country': None,
        'currency': 'USD',
        'weight': Decimal('0.078'),
    }
    # The dash is not a ticker.
    assert report.holdings[-1]['ticker'] is None


def test_an_isin_column_is_read_when_the_csv_has_one():
    header = (*ISHARES_HEADER, 'ISIN')
    lines = tuple(
        (*line, isin)
        for line, isin in zip(
            ISHARES_LINES, ['US67066G1040', 'US0378331005', 'US5949181045', '-'], strict=True
        )
    )

    report = read_ishares_holdings(holdings_csv(header=header, lines=lines))

    assert [holding['isin'] for holding in report.holdings] == [
        'US67066G1040',
        'US0378331005',
        'US5949181045',
        None,
    ]


def test_the_us_site_date_reads_too():
    facts = (ISHARES_FACTS[0], ('Fund Holdings as of', 'Sep 30, 2026'), *ISHARES_FACTS[2:])

    assert read_ishares_holdings(holdings_csv(facts=facts)).report_date == date(2026, 9, 30)


def test_an_ishares_csv_without_its_date_fails():
    facts = (ISHARES_FACTS[0], *ISHARES_FACTS[2:])

    with pytest.raises(IntegrationBadResponse, match='Fund Holdings as of'):
        read_ishares_holdings(holdings_csv(facts=facts))


def test_an_ishares_csv_cut_short_fails():
    with pytest.raises(IntegrationBadResponse, match='add up to'):
        read_ishares_holdings(holdings_csv(lines=ISHARES_LINES[:2]))


def test_an_ishares_csv_without_the_weight_column_fails_and_says_what_it_saw():
    header = tuple('Share' if column == 'Weight (%)' else column for column in ISHARES_HEADER)

    with pytest.raises(IntegrationBadResponse, match='no Name/Weight .*Market Value'):
        read_ishares_holdings(holdings_csv(header=header))


def test_the_gate_page_in_place_of_the_csv_fails():
    with pytest.raises(IntegrationBadResponse, match='answered a page'):
        read_ishares_holdings(b'<!DOCTYPE html><html>Select your investor type</html>')


# --- which classes are read ---------------------------------------------------


def test_a_holdings_source_is_the_sec_filing_or_a_manager_file_named_by_isin():
    american = EtfRegistry(source=EtfRegistrySource.SEC, name='IVV', domicile='US')
    ucits = EtfRegistry(source=EtfRegistrySource.ESMA, name='EXUS', domicile='IE')

    assert holdings_source(american, None) == EtfHoldingSource.SEC_NPORT
    assert holdings_source(ucits, EXUS_ISIN) == EtfHoldingSource.DWS
    assert holdings_source(ucits, CSPX_ISIN) == EtfHoldingSource.ISHARES
    # VWRA: Vanguard's file is not read.
    assert holdings_source(ucits, 'IE00BK5BQT80') is None
    assert holdings_source(ucits, None) is None


def test_every_ishares_class_read_has_its_product_page():
    """iShares addresses a file by its own product id, not by ISIN: a class
    added to the domain's list without its page would fail every run."""
    ishares = {
        isin
        for isin, source in MANAGER_HOLDINGS_FILES.items()
        if source == EtfHoldingSource.ISHARES
    }

    assert ishares
    assert ishares <= PRODUCTS.keys()
