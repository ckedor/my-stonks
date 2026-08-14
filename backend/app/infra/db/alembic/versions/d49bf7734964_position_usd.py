"""position usd

Revision ID: d49bf7734964
Revises: cb0dd98f3d9e
Create Date: 2025-04-14 17:08:02.883685
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd49bf7734964'
down_revision: Union[str, None] = 'cb0dd98f3d9e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('position', schema='portfolio') as batch_op:
        batch_op.add_column(sa.Column('price_usd', sa.Float(), nullable=False, server_default='0'))
        batch_op.add_column(
            sa.Column('average_price_usd', sa.Float(), nullable=False, server_default='0')
        )
        batch_op.add_column(
            sa.Column('daily_return_usd', sa.Float(), nullable=False, server_default='0')
        )
        batch_op.add_column(
            sa.Column('acc_return_usd', sa.Float(), nullable=False, server_default='0')
        )
        batch_op.add_column(sa.Column('twelve_months_return_usd', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('position', schema='portfolio') as batch_op:
        batch_op.drop_column('twelve_months_return_usd')
        batch_op.drop_column('acc_return_usd')
        batch_op.drop_column('daily_return_usd')
        batch_op.drop_column('average_price_usd')
        batch_op.drop_column('price_usd')
