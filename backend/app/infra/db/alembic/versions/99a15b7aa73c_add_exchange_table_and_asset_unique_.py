"""add exchange table and asset unique constraint

Revision ID: 99a15b7aa73c
Revises: bf813f49cdb5
Create Date: 2025-05-07 16:45:48.476294
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '99a15b7aa73c'
down_revision: Union[str, None] = 'bf813f49cdb5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'exchange',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('code', sa.String(length=10), nullable=False, unique=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        schema='asset',
    )

    op.execute("""
        INSERT INTO asset.exchange (code, name) VALUES
        ('NASDAQ', 'Nasdaq Stock Market'),
        ('NYSE', 'New York Stock Exchange'),
        ('AMEX', 'American Stock Exchange'),
        ('B3', 'Brasil Bolsa Balcão'),
        ('OTC', 'Over-the-Counter Market')
    """)

    op.add_column('asset', sa.Column('exchange_id', sa.Integer(), nullable=True), schema='asset')
    op.create_foreign_key(
        'fk_asset_exchange_id',
        'asset',
        'exchange',
        ['exchange_id'],
        ['id'],
        source_schema='asset',
        referent_schema='asset',
    )

    with op.batch_alter_table('asset', schema='asset') as batch_op:
        batch_op.create_unique_constraint(
            'uq_asset_ticker_exchange_type', ['ticker', 'exchange_id', 'asset_type_id']
        )


def downgrade() -> None:
    with op.batch_alter_table('asset', schema='asset') as batch_op:
        batch_op.drop_constraint('uq_asset_ticker_exchange_type', type_='unique')

    op.drop_constraint('fk_asset_exchange_id', 'asset', schema='asset', type_='foreignkey')
    op.drop_column('asset', 'exchange_id', schema='asset')
    op.drop_table('exchange', schema='asset')
