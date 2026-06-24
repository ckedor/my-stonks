import pandas as pd
from app.modules.portfolio.domain.portfolio_consolidation import build_position_df


def _transactions(entries: list[tuple[str, float]]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            'date': pd.to_datetime([date for date, _ in entries]),
            'quantity': [quantity for _, quantity in entries],
            'transaction_price_brl': 10.0,
            'transaction_price_usd': 2.0,
            'average_price': 10.0,
            'average_price_usd': 2.0,
        }
    )


def _prices(end_date: str) -> pd.DataFrame:
    dates = pd.date_range('2026-01-01', end_date)
    return pd.DataFrame({'date': dates, 'price': 10.0, 'price_usd': 2.0})


def test_build_position_trims_zeros_after_final_exit():
    result = build_position_df(
        transactions_df=_transactions([('2026-01-01', 10), ('2026-01-03', -10)]),
        prices_df=_prices('2026-01-06'),
        dividends_agg=pd.DataFrame(),
    )

    assert result['date'].max() == pd.Timestamp('2026-01-02')
    assert result['quantity'].tolist() == [10.0, 10.0]


def test_build_position_preserves_zeros_before_repurchase():
    result = build_position_df(
        transactions_df=_transactions(
            [('2026-01-01', 10), ('2026-01-03', -10), ('2026-01-06', 5)]
        ),
        prices_df=_prices('2026-01-06'),
        dividends_agg=pd.DataFrame(),
    )

    assert result['quantity'].tolist() == [10.0, 10.0, 0.0, 0.0, 0.0, 5.0]
