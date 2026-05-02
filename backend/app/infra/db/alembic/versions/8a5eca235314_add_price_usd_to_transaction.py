"""add price_usd to transaction

Revision ID: 8a5eca235314
Revises: 924168d3a5df
Create Date: 2026-04-27 07:51:41.090593

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '8a5eca235314'
down_revision: Union[str, None] = '924168d3a5df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'transaction',
        sa.Column('price_usd', sa.Float(), nullable=True),
        schema='portfolio',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('transaction', 'price_usd', schema='portfolio')
