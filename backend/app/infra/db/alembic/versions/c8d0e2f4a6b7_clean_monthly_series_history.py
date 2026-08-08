"""remove legacy daily filler from monthly series

Revision ID: c8d0e2f4a6b7
Revises: b6c8d0e2f4a5
Create Date: 2026-08-08 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = 'c8d0e2f4a6b7'
down_revision: Union[str, None] = 'b6c8d0e2f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM market_data.market_data_series_history AS history
        USING market_data.market_data_series AS series
        WHERE history.series_id = series.id
          AND series.frequency = 'monthly'
          AND EXTRACT(DAY FROM history.date) <> 1
        """
    )


def downgrade() -> None:
    # Removed filler rows were derived data and are intentionally not restored.
    pass
