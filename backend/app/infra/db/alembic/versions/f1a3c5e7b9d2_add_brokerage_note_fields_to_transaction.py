"""add brokerage note fields to transaction

Revision ID: f1a3c5e7b9d2
Revises: e6f8a0b2c4d3
Create Date: 2026-09-22 10:00:00.000000

A nota de corretagem traz o que o lançamento manual nunca trouxe: a data de
liquidação, os custos da operação e o IRRF retido na fonte. As três colunas são
nulas e ficam sem backfill, porque nulo aqui quer dizer "não se sabe": uma
operação lançada à mão antes do import não teve custo zero, só não teve custo
informado.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f1a3c5e7b9d2'
down_revision: Union[str, None] = 'e6f8a0b2c4d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('transaction', schema='portfolio') as batch_op:
        batch_op.add_column(sa.Column('settlement_date', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('fees', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('withheld_income_tax', sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('transaction', schema='portfolio') as batch_op:
        batch_op.drop_column('withheld_income_tax')
        batch_op.drop_column('fees')
        batch_op.drop_column('settlement_date')
