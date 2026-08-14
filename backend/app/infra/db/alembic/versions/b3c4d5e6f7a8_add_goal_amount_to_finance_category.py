"""add goal_amount to finance category

Revision ID: b3c4d5e6f7a8
Revises: c4f88d1a9b2e
Create Date: 2026-03-08 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'c4f88d1a9b2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'category',
        sa.Column('goal_amount', sa.Float(), nullable=True),
        schema='personal_finance',
    )


def downgrade() -> None:
    op.drop_column('category', 'goal_amount', schema='personal_finance')
