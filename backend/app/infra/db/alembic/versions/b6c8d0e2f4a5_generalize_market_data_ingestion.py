"""generalize market data series and ingestion

Revision ID: b6c8d0e2f4a5
Revises: a4b6c8d0e2f3
Create Date: 2026-08-08 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b6c8d0e2f4a5'
down_revision: Union[str, None] = 'a4b6c8d0e2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table('index', 'market_data_series', schema='market_data')
    op.rename_table(
        'index_history',
        'market_data_series_history',
        schema='market_data',
    )
    op.alter_column(
        'market_data_series_history',
        'index_id',
        new_column_name='series_id',
        schema='market_data',
    )
    op.add_column(
        'market_data_series',
        sa.Column('series_type', sa.String(length=30), nullable=True),
        schema='market_data',
    )
    op.add_column(
        'market_data_series',
        sa.Column('value_type', sa.String(length=30), nullable=True),
        schema='market_data',
    )
    op.add_column(
        'market_data_series',
        sa.Column('frequency', sa.String(length=20), nullable=True),
        schema='market_data',
    )
    op.execute(
        """
        UPDATE market_data.market_data_series
        SET
            series_type = CASE
                WHEN id = 1 THEN 'exchange_rate'
                WHEN id = 2 THEN 'inflation_rate'
                WHEN id = 3 THEN 'interest_rate'
                ELSE 'market_index'
            END,
            value_type = CASE
                WHEN id IN (2, 3) THEN 'percentage'
                WHEN id = 1 THEN 'exchange_rate'
                ELSE 'level'
            END,
            frequency = CASE WHEN id = 2 THEN 'monthly' ELSE 'daily' END
        """
    )
    for column in ('series_type', 'value_type', 'frequency'):
        op.alter_column(
            'market_data_series',
            column,
            nullable=False,
            schema='market_data',
        )
    op.add_column(
        'market_data_series_history',
        sa.Column(
            'source',
            sa.String(length=50),
            nullable=False,
            server_default='unknown',
        ),
        schema='market_data',
    )
    op.execute(
        'ALTER TABLE market_data.market_data_series_history '
        'RENAME CONSTRAINT uq_index_date TO uq_market_data_series_history_date'
    )

    op.create_table(
        'usd_brl_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('usd_to_brl_rate', sa.Numeric(18, 8), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('date', name='uq_usd_brl_history_date'),
        schema='market_data',
    )
    op.execute(
        """
        INSERT INTO market_data.usd_brl_history
            (date, usd_to_brl_rate, source)
        SELECT date, close, 'legacy'
        FROM market_data.market_data_series_history
        WHERE series_id = 1 AND close IS NOT NULL
        ON CONFLICT (date) DO NOTHING
        """
    )
    op.execute('DELETE FROM market_data.market_data_series_history WHERE series_id = 1')

    op.rename_table(
        'quote_ingestion_execution',
        'data_ingestion_execution',
        schema='market_data',
    )
    op.rename_table(
        'quote_ingestion_attempt',
        'data_ingestion_attempt',
        schema='market_data',
    )
    op.add_column(
        'data_ingestion_execution',
        sa.Column(
            'ingestion_type',
            sa.String(length=30),
            nullable=False,
            server_default='quote',
        ),
        schema='market_data',
    )
    op.create_index(
        'ix_market_data_data_ingestion_execution_ingestion_type',
        'data_ingestion_execution',
        ['ingestion_type'],
        schema='market_data',
    )
    op.alter_column(
        'data_ingestion_execution',
        'ingestion_type',
        server_default=None,
        schema='market_data',
    )
    for old, new in (
        ('total_assets', 'total_items'),
        ('processed_assets', 'processed_items'),
        ('succeeded_assets', 'succeeded_items'),
        ('failed_assets', 'failed_items'),
    ):
        op.alter_column(
            'data_ingestion_execution',
            old,
            new_column_name=new,
            schema='market_data',
        )
    op.execute(
        """
        DO $$
        DECLARE constraint_name text;
        BEGIN
            FOR constraint_name IN
                SELECT c.conname
                FROM pg_constraint c
                JOIN pg_attribute a
                  ON a.attrelid = c.conrelid
                 AND a.attnum = ANY(c.conkey)
                WHERE c.conrelid = 'market_data.data_ingestion_attempt'::regclass
                  AND c.contype = 'f'
                  AND a.attname IN ('asset_id', 'asset_type_id')
            LOOP
                EXECUTE format(
                    'ALTER TABLE market_data.data_ingestion_attempt DROP CONSTRAINT %I',
                    constraint_name
                );
            END LOOP;
        END $$;
        """
    )
    op.drop_column('data_ingestion_attempt', 'asset_type_id', schema='market_data')
    op.alter_column(
        'data_ingestion_attempt',
        'asset_id',
        new_column_name='item_id',
        schema='market_data',
    )
    op.alter_column(
        'data_ingestion_attempt',
        'ticker',
        new_column_name='item_label',
        existing_type=sa.String(length=30),
        type_=sa.String(length=100),
        schema='market_data',
    )


def downgrade() -> None:
    op.alter_column(
        'data_ingestion_attempt',
        'item_label',
        new_column_name='ticker',
        existing_type=sa.String(length=100),
        type_=sa.String(length=30),
        schema='market_data',
    )
    op.alter_column(
        'data_ingestion_attempt',
        'item_id',
        new_column_name='asset_id',
        schema='market_data',
    )
    op.add_column(
        'data_ingestion_attempt',
        sa.Column('asset_type_id', sa.Integer(), nullable=True),
        schema='market_data',
    )
    op.create_foreign_key(
        'data_ingestion_attempt_asset_id_fkey',
        'data_ingestion_attempt',
        'asset',
        ['asset_id'],
        ['id'],
        source_schema='market_data',
        referent_schema='asset',
    )
    op.create_foreign_key(
        'data_ingestion_attempt_asset_type_id_fkey',
        'data_ingestion_attempt',
        'asset_type',
        ['asset_type_id'],
        ['id'],
        source_schema='market_data',
        referent_schema='asset',
    )
    for old, new in (
        ('total_items', 'total_assets'),
        ('processed_items', 'processed_assets'),
        ('succeeded_items', 'succeeded_assets'),
        ('failed_items', 'failed_assets'),
    ):
        op.alter_column(
            'data_ingestion_execution',
            old,
            new_column_name=new,
            schema='market_data',
        )
    op.drop_index(
        'ix_market_data_data_ingestion_execution_ingestion_type',
        table_name='data_ingestion_execution',
        schema='market_data',
    )
    op.drop_column('data_ingestion_execution', 'ingestion_type', schema='market_data')
    op.rename_table(
        'data_ingestion_attempt',
        'quote_ingestion_attempt',
        schema='market_data',
    )
    op.rename_table(
        'data_ingestion_execution',
        'quote_ingestion_execution',
        schema='market_data',
    )

    op.execute(
        """
        INSERT INTO market_data.market_data_series_history
            (series_id, date, close, source)
        SELECT 1, date, usd_to_brl_rate, source
        FROM market_data.usd_brl_history
        ON CONFLICT (series_id, date) DO NOTHING
        """
    )
    op.drop_table('usd_brl_history', schema='market_data')
    op.execute(
        'ALTER TABLE market_data.market_data_series_history '
        'RENAME CONSTRAINT uq_market_data_series_history_date TO uq_index_date'
    )
    op.drop_column('market_data_series_history', 'source', schema='market_data')
    for column in ('frequency', 'value_type', 'series_type'):
        op.drop_column('market_data_series', column, schema='market_data')
    op.alter_column(
        'market_data_series_history',
        'series_id',
        new_column_name='index_id',
        schema='market_data',
    )
    op.rename_table(
        'market_data_series_history',
        'index_history',
        schema='market_data',
    )
    op.rename_table('market_data_series', 'index', schema='market_data')
