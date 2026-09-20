"""Número vem da aplicação, prosa vem do modelo.

O caso que mais importa é o da série curta: ausente lê como "não medido", e uma
volatilidade calculada sobre quatro dias leria como medição.
"""

import datetime
import random

import pytest

from app.modules.ai.domain.performance import summarize_performance

pytestmark = pytest.mark.unit


def _series(days: int, seed: int = 7) -> list[dict]:
    random.seed(seed)
    start = datetime.date(2023, 1, 2)
    price = 100.0
    quotes = []
    for offset in range(days):
        price *= 1 + random.gauss(0.0005, 0.012)
        quotes.append({
            'date': (start + datetime.timedelta(days=offset)).isoformat(),
            'close': price,
        })
    return quotes


def test_an_empty_series_measures_nothing():
    summary = summarize_performance([])

    assert summary.as_prompt_dict() == dict.fromkeys([
        'first_date',
        'last_date',
        'last_close',
        'return_12m_pct',
        'cagr_pct',
        'volatility_pct',
        'max_drawdown_pct',
    ])


def test_a_short_series_reports_the_price_and_refuses_the_metrics():
    summary = summarize_performance(_series(10))

    assert summary.last_close is not None
    assert summary.first_date == '2023-01-02'
    assert summary.cagr_pct is None
    assert summary.volatility_pct is None
    assert summary.max_drawdown_pct is None


def test_a_full_series_measures_everything():
    summary = summarize_performance(_series(400))

    assert summary.cagr_pct is not None
    assert summary.volatility_pct is not None
    assert summary.max_drawdown_pct is not None
    assert summary.return_12m_pct is not None


def test_a_series_shorter_than_a_trading_year_has_no_twelve_month_return():
    summary = summarize_performance(_series(200))

    assert summary.return_12m_pct is None
    assert summary.cagr_pct is not None


def test_quotes_without_a_close_are_ignored():
    quotes = _series(60)
    quotes[0]['close'] = None

    summary = summarize_performance(quotes)

    assert summary.last_close is not None


def test_the_figures_are_rounded_once_for_prompt_artifact_and_screen():
    values = summarize_performance(_series(400)).as_prompt_dict()

    assert values['volatility_pct'] == round(values['volatility_pct'], 2)
