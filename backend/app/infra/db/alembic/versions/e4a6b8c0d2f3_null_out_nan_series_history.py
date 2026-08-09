"""Replace NaN with NULL in market-data series history

PostgreSQL ``numeric`` accepts NaN, so ingestion happily stored the NaN that
pandas produces for a missing OHLC field. Reading those rows back then failed
to serialize to JSON. Absent means NULL.

Revision ID: e4a6b8c0d2f3
Revises: d3f5a7c9e1b2
Create Date: 2026-08-09

"""

from alembic import op

revision = 'e4a6b8c0d2f3'
down_revision = 'd3f5a7c9e1b2'
branch_labels = None
depends_on = None

NUMERIC_COLUMNS = ('open', 'high', 'low', 'close')


def upgrade() -> None:
    for column in NUMERIC_COLUMNS:
        op.execute(
            f"""
            UPDATE market_data.market_data_series_history
            SET {column} = NULL
            WHERE {column} = 'NaN'
            """
        )


def downgrade() -> None:
    # Which NULLs were NaN before is not recorded, and NaN was never a value
    # worth restoring.
    pass
