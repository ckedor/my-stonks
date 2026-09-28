"""MSCI market indexes: World, ACWI, EM, USA and ACWI ex-USA

Revision ID: a7c9e1b3d5f7
Revises: e4a6c8f0b2d3
Create Date: 2026-09-27 12:00:00.000000

Five market-data series of the `market_index` type, read from MSCI itself
rather than from an ETF that tracks them: the index goes back further (1997
for price, end of 2000 for net total return) than any of the ETFs. Each is
stored as net total return in USD; the symbol is MSCI's index code, which is
what the ingestion asks MSCI for.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a7c9e1b3d5f7'
down_revision: Union[str, None] = 'e4a6c8f0b2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

USD_CURRENCY_ID = 2

MSCI_SERIES = (
    (8, '990100', 'MSCI World', 'MSCI World Net Total Return'),
    (9, '892400', 'MSCI ACWI', 'MSCI All Country World Net Total Return'),
    (10, '891800', 'MSCI EM', 'MSCI Emerging Markets Net Total Return'),
    (11, '984000', 'MSCI USA', 'MSCI USA Net Total Return'),
    (12, '899901', 'MSCI ACWI ex-USA', 'MSCI All Country World ex USA Net Total Return'),
)


def upgrade() -> None:
    bind = op.get_bind()
    for series_id, symbol, short_name, name in MSCI_SERIES:
        bind.execute(
            sa.text(
                """
                INSERT INTO market_data.market_data_series
                    (id, symbol, short_name, name, series_type, value_type, frequency, currency_id)
                VALUES
                    (:id, :symbol, :short_name, :name, 'market_index', 'level', 'daily', :currency_id)
                ON CONFLICT DO NOTHING
                """
            ),
            {
                'id': series_id,
                'symbol': symbol,
                'short_name': short_name,
                'name': name,
                'currency_id': USD_CURRENCY_ID,
            },
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
    ids = [series_id for series_id, *_ in MSCI_SERIES]
    bind = op.get_bind()
    bind.execute(
        sa.text(
            'DELETE FROM market_data.market_data_series_history WHERE series_id = ANY(:ids)'
        ),
        {'ids': ids},
    )
    bind.execute(
        sa.text('DELETE FROM market_data.market_data_series WHERE id = ANY(:ids)'),
        {'ids': ids},
    )
