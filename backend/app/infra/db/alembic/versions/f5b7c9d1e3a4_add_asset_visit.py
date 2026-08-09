"""Track how often a user opens each asset

Interest is inferred from visits rather than an explicit star, so the market
screen can surface the assets someone actually returns to.

Revision ID: f5b7c9d1e3a4
Revises: e4a6b8c0d2f3
Create Date: 2026-08-09

"""

import sqlalchemy as sa
from alembic import op

revision = 'f5b7c9d1e3a4'
down_revision = 'e4a6b8c0d2f3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'asset_visit',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=False),
        sa.Column('visit_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column(
            'last_visited_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(['user_id'], ['public.user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['asset_id'], ['asset.asset.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id', 'asset_id', name='uq_asset_visit_user_asset'),
        schema='market_data',
    )
    # The favourites list reads by user and orders by count.
    op.create_index(
        'ix_asset_visit_user_count',
        'asset_visit',
        ['user_id', 'visit_count'],
        schema='market_data',
    )


def downgrade() -> None:
    op.drop_index('ix_asset_visit_user_count', table_name='asset_visit', schema='market_data')
    op.drop_table('asset_visit', schema='market_data')
