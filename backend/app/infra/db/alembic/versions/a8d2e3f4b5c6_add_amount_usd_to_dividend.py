"""add amount_usd to dividend and backfill from USD/BRL history

Revision ID: a8d2e3f4b5c6
Revises: c4f88d1a9b2e
Create Date: 2026-03-31 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a8d2e3f4b5c6'
down_revision: Union[str, Sequence[str]] = ('c4f88d1a9b2e', '87d535e79aef')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add column
    op.add_column(
        'dividend',
        sa.Column('amount_usd', sa.Float(), nullable=True),
        schema='portfolio',
    )

    # 2. Backfill using USD/BRL history
    # For each dividend, amount_usd = amount / usdbrl close price on that date
    # Uses forward-fill: if no exact date match, use the most recent prior rate
    op.execute("""
        UPDATE portfolio.dividend d
        SET amount_usd = d.amount / COALESCE(
            (
                SELECT ih.close
                FROM market_data.index_history ih
                JOIN market_data.index i ON i.id = ih.index_id
                WHERE i.short_name = 'USD/BRL'
                  AND ih.date <= d.date
                ORDER BY ih.date DESC
                LIMIT 1
            ),
            5.0  -- fallback rate if no history available
        )
        WHERE d.amount_usd IS NULL
    """)


def downgrade() -> None:
    op.drop_column('dividend', 'amount_usd', schema='portfolio')
