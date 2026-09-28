"""Gold: a commodity price series in USD per troy ounce

Revision ID: b8d0f2a4c6e8
Revises: a7c9e1b3d5f7
Create Date: 2026-09-28 12:00:00.000000

A market-data series of the new `commodity_price` type: gold is not an index,
and filing it as `market_index` would say something the data does not. The
symbol is the provider's continuous COMEX front-month contract, which goes
back to 2000 — longer than any gold ETF.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b8d0f2a4c6e8'
down_revision: Union[str, None] = 'a7c9e1b3d5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GOLD_SERIES_ID = 13
USD_CURRENCY_ID = 2


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO market_data.market_data_series
                (id, symbol, short_name, name, series_type, value_type, frequency, currency_id)
            VALUES
                (:id, 'GC=F', 'Ouro', 'Ouro (COMEX, US$ por onça troy)',
                 'commodity_price', 'level', 'daily', :currency_id)
            ON CONFLICT DO NOTHING
            """
        ),
        {'id': GOLD_SERIES_ID, 'currency_id': USD_CURRENCY_ID},
    )
    bind.execute(
        sa.text(
            """
            SELECT setval(
                pg_get_serial_sequence('market_data.market_data_series', 'id'),
                (SELECT MAX(id) FROM market_data.market_data_series)
            )
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text('DELETE FROM market_data.market_data_series_history WHERE series_id = :id'),
        {'id': GOLD_SERIES_ID},
    )
    bind.execute(
        sa.text('DELETE FROM market_data.market_data_series WHERE id = :id'),
        {'id': GOLD_SERIES_ID},
    )
