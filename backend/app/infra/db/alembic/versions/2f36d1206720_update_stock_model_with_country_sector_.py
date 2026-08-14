"""update stock model with country, sector, industry

Revision ID: 2f36d1206720
Revises: 99a15b7aa73c
Create Date: 2025-05-07 16:55:41.941964

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '2f36d1206720'
down_revision: Union[str, None] = '99a15b7aa73c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('stock', schema='asset') as batch_op:
        batch_op.drop_column('segment')
        batch_op.add_column(sa.Column('country', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('sector', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('industry', sa.String(length=100), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('stock', schema='asset') as batch_op:
        batch_op.drop_column('industry')
        batch_op.drop_column('sector')
        batch_op.drop_column('country')
        batch_op.add_column(sa.Column('segment', sa.String(length=100)))
