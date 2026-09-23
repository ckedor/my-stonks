"""add brokerage note

Revision ID: a7c9e1b3d5f2
Revises: f1a3c5e7b9d2
Create Date: 2026-09-22 20:00:00.000000

A nota de corretagem importada passa a ser guardada: o pregão, os totais e os
custos como a corretora imprimiu. A transação ganha a referência à nota que a
criou ou completou, e perde só a referência (SET NULL) se a nota for apagada —
a operação continua tendo acontecido.

A nota é única por carteira, corretora e número: reimportar a mesma nota
atualiza a linha em vez de criar outra.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a7c9e1b3d5f2'
down_revision: Union[str, None] = 'f1a3c5e7b9d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'brokerage_note',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'portfolio_id', sa.Integer(), sa.ForeignKey('portfolio.portfolio.id'), nullable=False
        ),
        sa.Column('broker_id', sa.Integer(), sa.ForeignKey('portfolio.broker.id'), nullable=False),
        sa.Column('note_number', sa.String(40), nullable=True),
        sa.Column('trade_date', sa.Date(), nullable=False),
        sa.Column('settlement_date', sa.Date(), nullable=True),
        sa.Column('purchases_total', sa.Float(), nullable=True),
        sa.Column('sales_total', sa.Float(), nullable=True),
        sa.Column('operations_total', sa.Float(), nullable=True),
        sa.Column('settlement_fee', sa.Float(), nullable=True),
        sa.Column('registration_fee', sa.Float(), nullable=True),
        sa.Column('emoluments', sa.Float(), nullable=True),
        sa.Column('other_exchange_fees', sa.Float(), nullable=True),
        sa.Column('brokerage', sa.Float(), nullable=True),
        sa.Column('iss', sa.Float(), nullable=True),
        sa.Column('other_costs', sa.Float(), nullable=True),
        sa.Column('withheld_income_tax', sa.Float(), nullable=True),
        sa.Column('net_amount', sa.Float(), nullable=True),
        sa.Column(
            'imported_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            'portfolio_id', 'broker_id', 'note_number', name='uq_brokerage_note_by_broker_number'
        ),
        schema='portfolio',
    )
    with op.batch_alter_table('transaction', schema='portfolio') as batch_op:
        batch_op.add_column(sa.Column('brokerage_note_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_transaction_brokerage_note',
            'brokerage_note',
            ['brokerage_note_id'],
            ['id'],
            referent_schema='portfolio',
            ondelete='SET NULL',
        )
        batch_op.create_index('ix_portfolio_transaction_brokerage_note_id', ['brokerage_note_id'])


def downgrade() -> None:
    with op.batch_alter_table('transaction', schema='portfolio') as batch_op:
        batch_op.drop_index('ix_portfolio_transaction_brokerage_note_id')
        batch_op.drop_constraint('fk_transaction_brokerage_note', type_='foreignkey')
        batch_op.drop_column('brokerage_note_id')
    op.drop_table('brokerage_note', schema='portfolio')
