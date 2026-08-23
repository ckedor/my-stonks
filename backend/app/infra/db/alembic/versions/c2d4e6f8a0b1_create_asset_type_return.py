"""Create persisted returns grouped by asset type.

Revision ID: c2d4e6f8a0b1
Revises: a1c3e5f7b9d0
Create Date: 2026-08-22
"""

import sqlalchemy as sa
from alembic import op

revision = 'c2d4e6f8a0b1'
down_revision = 'a1c3e5f7b9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'asset_type_return',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('portfolio_id', sa.Integer(), nullable=False),
        sa.Column('asset_type_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('daily_return', sa.Float(), nullable=False),
        sa.Column('acc_return', sa.Float(), nullable=False),
        sa.Column('cagr', sa.Float(), nullable=True),
        sa.Column('daily_return_usd', sa.Float(), nullable=True),
        sa.Column('acc_return_usd', sa.Float(), nullable=True),
        sa.Column('cagr_usd', sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(['asset_type_id'], ['asset.asset_type.id']),
        sa.ForeignKeyConstraint(['portfolio_id'], ['portfolio.portfolio.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'portfolio_id',
            'asset_type_id',
            'date',
            name='uq_asset_type_return_portfolio_type_date',
        ),
        schema='portfolio',
    )


def downgrade() -> None:
    op.drop_table('asset_type_return', schema='portfolio')
