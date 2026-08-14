"""create portfolio_return and category_return tables

Revision ID: f8a9b0c1d2e3
Revises: e7a1f2b3c4d5
Create Date: 2026-03-31 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f8a9b0c1d2e3'
down_revision: Union[str, None] = 'e7a1f2b3c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'portfolio_return',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'portfolio_id', sa.Integer(), sa.ForeignKey('portfolio.portfolio.id'), nullable=False
        ),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('daily_return', sa.Float(), nullable=False),
        sa.Column('acc_return', sa.Float(), nullable=False),
        sa.Column('cagr', sa.Float(), nullable=True),
        sa.UniqueConstraint('portfolio_id', 'date', name='uq_portfolio_return_portfolio_date'),
        schema='portfolio',
    )

    op.create_table(
        'category_return',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'portfolio_id', sa.Integer(), sa.ForeignKey('portfolio.portfolio.id'), nullable=False
        ),
        sa.Column(
            'custom_category_id',
            sa.Integer(),
            sa.ForeignKey('portfolio.custom_category.id'),
            nullable=False,
        ),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('daily_return', sa.Float(), nullable=False),
        sa.Column('acc_return', sa.Float(), nullable=False),
        sa.Column('cagr', sa.Float(), nullable=True),
        sa.UniqueConstraint(
            'portfolio_id',
            'custom_category_id',
            'date',
            name='uq_category_return_portfolio_category_date',
        ),
        schema='portfolio',
    )


def downgrade() -> None:
    op.drop_table('category_return', schema='portfolio')
    op.drop_table('portfolio_return', schema='portfolio')
