"""add nova_coluna

Revision ID: cb0dd98f3d9e
Revises: 4b1ac037fd21
Create Date: 2025-04-14 15:19:36.030950

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'cb0dd98f3d9e'
down_revision: Union[str, None] = '4b1ac037fd21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('position', schema='portfolio') as batch_op:
        batch_op.add_column(
            sa.Column('daily_return', sa.Float(), nullable=False, server_default='0')
        )
        batch_op.add_column(sa.Column('acc_return', sa.Float(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('twelve_months_return', sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('position', schema='portfolio') as batch_op:
        batch_op.drop_column('twelve_months_return')
        batch_op.drop_column('acc_return')
        batch_op.drop_column('daily_return')
