"""add currency to brokerage note

Revision ID: c3e5a7b9d1f4
Revises: a7c9e1b3d5f2
Create Date: 2026-09-22 22:00:00.000000

Uma nota não é sempre em reais: a confirmação de uma corretora americana é em
dólar, e os totais e custos guardados estão na moeda em que ela foi emitida. As
notas já gravadas vieram todas de corretoras brasileiras, daí o default.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c3e5a7b9d1f4'
down_revision: Union[str, None] = 'a7c9e1b3d5f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('brokerage_note', schema='portfolio') as batch_op:
        batch_op.add_column(
            sa.Column('currency', sa.String(3), nullable=False, server_default='BRL')
        )


def downgrade() -> None:
    with op.batch_alter_table('brokerage_note', schema='portfolio') as batch_op:
        batch_op.drop_column('currency')
