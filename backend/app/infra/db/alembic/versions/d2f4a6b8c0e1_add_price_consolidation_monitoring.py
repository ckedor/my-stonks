"""add price consolidation monitoring

Revision ID: d2f4a6b8c0e1
Revises: c7d8e9f0a1b2
Create Date: 2026-08-02 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd2f4a6b8c0e1'
down_revision: Union[str, None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'price_consolidation_execution',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.String(length=100), nullable=True),
        sa.Column('trigger', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('force_full_history', sa.Boolean(), nullable=False),
        sa.Column('parameters', sa.JSON(), nullable=False),
        sa.Column('requested_by_user_id', sa.Integer(), nullable=True),
        sa.Column(
            'requested_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_assets', sa.Integer(), nullable=False),
        sa.Column('processed_assets', sa.Integer(), nullable=False),
        sa.Column('succeeded_assets', sa.Integer(), nullable=False),
        sa.Column('failed_assets', sa.Integer(), nullable=False),
        sa.Column('fetched_rows', sa.Integer(), nullable=False),
        sa.Column('upserted_rows', sa.Integer(), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ['requested_by_user_id'],
            ['public.user.id'],
        ),
        sa.PrimaryKeyConstraint('id'),
        schema='market_data',
    )
    op.create_index(
        op.f('ix_market_data_price_consolidation_execution_status'),
        'price_consolidation_execution',
        ['status'],
        unique=False,
        schema='market_data',
    )
    op.create_index(
        op.f('ix_market_data_price_consolidation_execution_task_id'),
        'price_consolidation_execution',
        ['task_id'],
        unique=False,
        schema='market_data',
    )

    op.create_table(
        'price_consolidation_attempt',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('execution_id', sa.Integer(), nullable=False),
        sa.Column('asset_id', sa.Integer(), nullable=True),
        sa.Column('ticker', sa.String(length=30), nullable=False),
        sa.Column('asset_type_id', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('parameters', sa.JSON(), nullable=False),
        sa.Column(
            'attempted_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('fetched_rows', sa.Integer(), nullable=False),
        sa.Column('upserted_rows', sa.Integer(), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['asset_id'], ['asset.asset.id']),
        sa.ForeignKeyConstraint(['asset_type_id'], ['asset.asset_type.id']),
        sa.ForeignKeyConstraint(
            ['execution_id'],
            ['market_data.price_consolidation_execution.id'],
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
        schema='market_data',
    )
    op.create_index(
        op.f('ix_market_data_price_consolidation_attempt_execution_id'),
        'price_consolidation_attempt',
        ['execution_id'],
        unique=False,
        schema='market_data',
    )
    op.create_index(
        op.f('ix_market_data_price_consolidation_attempt_status'),
        'price_consolidation_attempt',
        ['status'],
        unique=False,
        schema='market_data',
    )


def downgrade() -> None:
    op.drop_index(
        op.f('ix_market_data_price_consolidation_attempt_status'),
        table_name='price_consolidation_attempt',
        schema='market_data',
    )
    op.drop_index(
        op.f('ix_market_data_price_consolidation_attempt_execution_id'),
        table_name='price_consolidation_attempt',
        schema='market_data',
    )
    op.drop_table('price_consolidation_attempt', schema='market_data')
    op.drop_index(
        op.f('ix_market_data_price_consolidation_execution_task_id'),
        table_name='price_consolidation_execution',
        schema='market_data',
    )
    op.drop_index(
        op.f('ix_market_data_price_consolidation_execution_status'),
        table_name='price_consolidation_execution',
        schema='market_data',
    )
    op.drop_table('price_consolidation_execution', schema='market_data')
