"""Store both USD/BRL directions and drop the exchange rate from market-data series

The canonical exchange rate is not a market-data series: it has its own table.
This renames ``usd_to_brl_rate`` to ``usd_brl``, adds the precomputed inverse
``brl_usd`` so consumers never divide, and removes the leftover USD/BRL series
row (which carried no history).

Revision ID: d3f5a7c9e1b2
Revises: c8d0e2f4a6b7
Create Date: 2026-08-09

"""

import sqlalchemy as sa
from alembic import op

revision = 'd3f5a7c9e1b2'
down_revision = 'c8d0e2f4a6b7'
branch_labels = None
depends_on = None

USD_BRL_SERIES_ID = 1
CDI_SERIES_ID = 3


def upgrade() -> None:
    op.alter_column(
        'usd_brl_history',
        'usd_to_brl_rate',
        new_column_name='usd_brl',
        schema='market_data',
    )
    op.add_column(
        'usd_brl_history',
        sa.Column('brl_usd', sa.Numeric(20, 12), nullable=True),
        schema='market_data',
    )
    # Backfill the inverse for every existing observation.
    op.execute(
        """
        UPDATE market_data.usd_brl_history
        SET brl_usd = ROUND(1 / usd_brl, 12)
        WHERE usd_brl > 0
        """
    )
    # Rows with a non-positive rate cannot be inverted and were never valid.
    op.execute('DELETE FROM market_data.usd_brl_history WHERE brl_usd IS NULL')
    op.alter_column(
        'usd_brl_history',
        'brl_usd',
        nullable=False,
        schema='market_data',
    )

    # Categories benchmarked against the exchange rate move to CDI, the default
    # Brazilian benchmark, before the series row goes away.
    op.execute(
        f"""
        UPDATE portfolio.custom_category
        SET benchmark_id = {CDI_SERIES_ID}
        WHERE benchmark_id = {USD_BRL_SERIES_ID}
        """
    )
    op.execute(
        f"""
        DELETE FROM market_data.market_data_series_history
        WHERE series_id = {USD_BRL_SERIES_ID}
        """
    )
    op.execute(f'DELETE FROM market_data.market_data_series WHERE id = {USD_BRL_SERIES_ID}')


def downgrade() -> None:
    op.execute(
        f"""
        INSERT INTO market_data.market_data_series
            (id, symbol, short_name, name, series_type, value_type, frequency, currency_id)
        VALUES (
            {USD_BRL_SERIES_ID}, 'USD/BRL', 'USD/BRL', 'Dólar Americano',
            'exchange_rate', 'exchange_rate', 'daily', 1
        )
        ON CONFLICT (id) DO NOTHING
        """
    )
    # Which categories pointed at the exchange rate is not recorded, so the
    # benchmark reassignment done on upgrade is not reversed here.
    op.drop_column('usd_brl_history', 'brl_usd', schema='market_data')
    op.alter_column(
        'usd_brl_history',
        'usd_brl',
        new_column_name='usd_to_brl_rate',
        schema='market_data',
    )
