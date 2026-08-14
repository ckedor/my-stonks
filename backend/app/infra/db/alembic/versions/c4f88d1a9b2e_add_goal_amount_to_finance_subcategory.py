"""add goal_amount to finance subcategory

Revision ID: c4f88d1a9b2e
Revises: a1b2c3d4e5f6
Create Date: 2026-03-01 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c4f88d1a9b2e'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'subcategory',
        sa.Column('goal_amount', sa.Float(), nullable=True),
        schema='personal_finance',
    )


def downgrade() -> None:
    op.drop_column('subcategory', 'goal_amount', schema='personal_finance')
