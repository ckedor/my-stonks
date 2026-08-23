from types import SimpleNamespace
from unittest.mock import AsyncMock

import pandas as pd
import pytest

from app.modules.market_data.domain.constants import CURRENCY, SERIES
from app.modules.market_data.service.market_data_service import MarketDataReadService


class FakeUnitOfWork:
    def __init__(self, rows: list[dict]):
        self.market_data = SimpleNamespace(
            get_series_history_values=AsyncMock(return_value=rows),
        )

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        return None


def build_service(rows: list[dict]) -> MarketDataReadService:
    usd_brl = SimpleNamespace(
        get_full_history=AsyncMock(
            return_value=[
                {
                    'date': '2025-01-02',
                    'usd_brl': '5.0',
                    'brl_usd': '0.2',
                    'source': 'test',
                },
                {
                    'date': '2025-01-03',
                    'usd_brl': '6.0',
                    'brl_usd': str(1 / 6),
                    'source': 'test',
                },
            ]
        )
    )
    return MarketDataReadService(FakeUnitOfWork(rows), usd_brl)


def last_value(result: dict, series: str) -> float:
    return result[series][-1]['value']


@pytest.mark.asyncio
async def test_all_series_are_restated_before_returns_are_calculated():
    rows = [
        {
            'date': '2025-01-02',
            'value': 100,
            'index_symbol': '^GSPC',
            'index_name': 'S&P500',
            'currency_id': CURRENCY.USD,
        },
        {
            'date': '2025-01-03',
            'value': 110,
            'index_symbol': '^GSPC',
            'index_name': 'S&P500',
            'currency_id': CURRENCY.USD,
        },
        {
            'date': '2025-01-02',
            'value': 100,
            'index_symbol': '^BVSP',
            'index_name': 'IBOVESPA',
            'currency_id': CURRENCY.BRL,
        },
        {
            'date': '2025-01-03',
            'value': 110,
            'index_symbol': '^BVSP',
            'index_name': 'IBOVESPA',
            'currency_id': CURRENCY.BRL,
        },
        {
            'date': '2025-01-02',
            'value': 0,
            'index_symbol': 'CDI',
            'index_name': 'CDI',
            'currency_id': CURRENCY.BRL,
        },
        {
            'date': '2025-01-03',
            'value': 10,
            'index_symbol': 'CDI',
            'index_name': 'CDI',
            'currency_id': CURRENCY.BRL,
        },
    ]
    service = build_service(rows)
    start_date = pd.Timestamp('2025-01-02')

    in_brl = await service.compute_indexes_history(start_date, 'BRL')
    in_usd = await service.compute_indexes_history(start_date, 'USD')

    assert last_value(in_brl, 'S&P500') == pytest.approx(0.32)
    assert last_value(in_usd, 'S&P500') == pytest.approx(0.10)
    assert last_value(in_brl, 'IBOVESPA') == pytest.approx(0.10)
    assert last_value(in_usd, 'IBOVESPA') == pytest.approx(-1 / 12)
    assert last_value(in_brl, 'CDI') == pytest.approx(0.10)
    assert last_value(in_usd, 'CDI') == pytest.approx(-1 / 12)

    # Holding USD earns the FX variation in BRL, but is constant in USD.
    assert last_value(in_brl, 'USD/BRL') == pytest.approx(0.20)
    assert last_value(in_usd, 'USD/BRL') == pytest.approx(0)
    assert {point['value'] for point in in_usd['USD/BRL']} == {0}


@pytest.mark.asyncio
async def test_single_series_reader_uses_the_requested_currency_for_analysis():
    rows = [
        {
            'date': '2025-01-02',
            'value': 0,
            'index_name': 'CDI',
            'currency_id': CURRENCY.BRL,
        },
        {
            'date': '2025-01-03',
            'value': 10,
            'index_name': 'CDI',
            'currency_id': CURRENCY.BRL,
        },
    ]
    service = build_service(rows)

    values = await service.get_series_history_values(
        pd.Timestamp('2025-01-02'),
        SERIES.CDI,
        'USD',
    )

    assert values.iloc[0] == pytest.approx(20)
    assert values.iloc[1] == pytest.approx(110 / 6)
