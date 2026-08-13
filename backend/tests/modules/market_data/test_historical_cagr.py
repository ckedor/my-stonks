"""Annualized growth computed over an asset's served quote history."""

from datetime import date

from app.modules.market_data.domain.quote import historical_cagr

#: 731 calendar days is a shade over two average years, so a doubling lands just
#: under the 41.42% that an exact two-year doubling would give.
DOUBLED_IN_TWO_YEARS = 0.4139


def quote(on: date, close: float | None, adjusted: float | None = None) -> dict:
    return {'date': on.isoformat(), 'close': close, 'adjusted_close': adjusted}


def test_doubling_over_two_years_is_about_forty_one_percent_a_year():
    result = historical_cagr([
        quote(date(2024, 1, 1), 100.0),
        quote(date(2026, 1, 1), 200.0),
    ])

    assert result is not None
    assert result.start_date == date(2024, 1, 1)
    assert result.end_date == date(2026, 1, 1)
    assert round(result.value, 4) == DOUBLED_IN_TWO_YEARS


def test_the_adjusted_close_is_what_the_rate_measures():
    """A fund that pays out its result looks flat on its own traded price.

    Its holders were paid all along, which is exactly what the adjusted series
    records -- so the rate has to be read from that one.
    """
    flat_price_paid_out = [
        quote(date(2024, 1, 1), 100.0, adjusted=100.0),
        quote(date(2026, 1, 1), 100.0, adjusted=200.0),
    ]

    assert round(historical_cagr(flat_price_paid_out).value, 4) == DOUBLED_IN_TWO_YEARS


def test_quotes_with_no_adjusted_series_fall_back_to_the_traded_close():
    result = historical_cagr([
        quote(date(2024, 1, 1), 100.0),
        quote(date(2026, 1, 1), 200.0),
    ])

    assert round(result.value, 4) == DOUBLED_IN_TWO_YEARS


def test_the_window_travels_with_the_rate_when_serialized():
    result = historical_cagr([
        quote(date(2020, 5, 4), 10.0),
        quote(date(2026, 5, 4), 20.0),
    ])

    assert result.to_dict()['start_date'] == '2020-05-04'
    assert result.to_dict()['end_date'] == '2026-05-04'


def test_quotes_without_a_close_do_not_bound_the_window():
    result = historical_cagr([
        quote(date(2023, 12, 1), None),
        quote(date(2024, 1, 1), 100.0),
        quote(date(2026, 1, 1), 200.0),
        quote(date(2026, 2, 1), None),
    ])

    assert result.start_date == date(2024, 1, 1)
    assert result.end_date == date(2026, 1, 1)


def test_history_shorter_than_a_year_is_not_annualized():
    assert (
        historical_cagr([
            quote(date(2026, 1, 1), 100.0),
            quote(date(2026, 6, 1), 200.0),
        ])
        is None
    )


def test_a_series_that_cannot_be_measured_reports_nothing():
    assert historical_cagr([]) is None
    assert historical_cagr([quote(date(2024, 1, 1), 100.0)]) is None
    assert (
        historical_cagr([
            quote(date(2024, 1, 1), 0.0),
            quote(date(2026, 1, 1), 200.0),
        ])
        is None
    )
