"""extend asset price history

Revision ID: c7d8e9f0a1b2
Revises: 8a5eca235314
Create Date: 2026-07-26 00:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, None] = '8a5eca235314'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'asset_price_history',
        sa.Column('currency_id', sa.Integer(), nullable=True),
        schema='market_data',
    )
    op.add_column(
        'asset_price_history',
        sa.Column('volume', sa.Numeric(precision=24, scale=8), nullable=True),
        schema='market_data',
    )
    op.add_column(
        'asset_price_history',
        sa.Column('source', sa.String(length=50), server_default='unknown', nullable=False),
        schema='market_data',
    )
    op.add_column(
        'asset_price_history',
        sa.Column('adjusted_close', sa.Numeric(precision=18, scale=8), nullable=True),
        schema='market_data',
    )
    op.add_column(
        'asset_price_history',
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('CURRENT_TIMESTAMP'),
            nullable=False,
        ),
        schema='market_data',
    )
    op.create_foreign_key(
        'fk_asset_price_history_currency_id',
        'asset_price_history',
        'currency',
        ['currency_id'],
        ['id'],
        source_schema='market_data',
        referent_schema='asset',
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION market_data.set_asset_price_history_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER trg_asset_price_history_set_updated_at
        BEFORE UPDATE ON market_data.asset_price_history
        FOR EACH ROW
        EXECUTE FUNCTION market_data.set_asset_price_history_updated_at();
        """
    )


def downgrade() -> None:
    op.execute(
        'DROP TRIGGER IF EXISTS trg_asset_price_history_set_updated_at '
        'ON market_data.asset_price_history;'
    )
    op.execute('DROP FUNCTION IF EXISTS market_data.set_asset_price_history_updated_at();')

    op.drop_constraint(
        'fk_asset_price_history_currency_id',
        'asset_price_history',
        schema='market_data',
        type_='foreignkey',
    )
    op.drop_column('asset_price_history', 'updated_at', schema='market_data')
    op.drop_column('asset_price_history', 'adjusted_close', schema='market_data')
    op.drop_column('asset_price_history', 'source', schema='market_data')
    op.drop_column('asset_price_history', 'volume', schema='market_data')
    op.drop_column('asset_price_history', 'currency_id', schema='market_data')
