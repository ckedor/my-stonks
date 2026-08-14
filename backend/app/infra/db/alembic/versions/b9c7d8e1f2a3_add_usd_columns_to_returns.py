"""add usd columns to portfolio_return and category_return

Revision ID: b9c7d8e1f2a3
Revises: a8d2e3f4b5c6
Create Date: 2026-04-01 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b9c7d8e1f2a3'
down_revision: Union[str, Sequence[str]] = 'a8d2e3f4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'portfolio_return',
        sa.Column('daily_return_usd', sa.Float(), nullable=True),
        schema='portfolio',
    )
    op.add_column(
        'portfolio_return',
        sa.Column('acc_return_usd', sa.Float(), nullable=True),
        schema='portfolio',
    )
    op.add_column(
        'portfolio_return',
        sa.Column('cagr_usd', sa.Float(), nullable=True),
        schema='portfolio',
    )

    op.add_column(
        'category_return',
        sa.Column('daily_return_usd', sa.Float(), nullable=True),
        schema='portfolio',
    )
    op.add_column(
        'category_return',
        sa.Column('acc_return_usd', sa.Float(), nullable=True),
        schema='portfolio',
    )
    op.add_column(
        'category_return',
        sa.Column('cagr_usd', sa.Float(), nullable=True),
        schema='portfolio',
    )


def downgrade() -> None:
    op.drop_column('category_return', 'cagr_usd', schema='portfolio')
    op.drop_column('category_return', 'acc_return_usd', schema='portfolio')
    op.drop_column('category_return', 'daily_return_usd', schema='portfolio')

    op.drop_column('portfolio_return', 'cagr_usd', schema='portfolio')
    op.drop_column('portfolio_return', 'acc_return_usd', schema='portfolio')
    op.drop_column('portfolio_return', 'daily_return_usd', schema='portfolio')
