"""Remove currency_id from transaction

Revision ID: 4b1ac037fd21
Revises: 2abd11219338
Create Date: 2025-04-09 20:00:42.682356

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '4b1ac037fd21'
down_revision: Union[str, None] = '2abd11219338'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        'transaction_currency_id_fkey', 'transaction', schema='portfolio', type_='foreignkey'
    )
    op.drop_column('transaction', 'currency_id', schema='portfolio')
    pass


def downgrade() -> None:
    op.add_column(
        'transaction', sa.Column('currency_id', sa.Integer(), nullable=False), schema='portfolio'
    )
    op.create_foreign_key(
        'transaction_currency_id_fkey',
        'transaction',
        'currency',
        ['currency_id'],
        ['id'],
        source_schema='portfolio',
        referent_schema='asset',
    )
    pass
