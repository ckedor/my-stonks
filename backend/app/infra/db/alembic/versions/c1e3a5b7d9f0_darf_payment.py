"""add darf payment

Revision ID: c1e3a5b7d9f0
Revises: b8d0f2a4c6e8
Create Date: 2026-09-29 12:00:00.000000

O DARF pago passa a ser registrado. A apuração calcula o imposto; se ele foi
pago é um fato que só a pessoa conhece, e presumir o pagamento a partir do
cálculo mostraria como quitado um imposto em atraso.

O pagamento é do usuário, e não de uma carteira: o contribuinte é um só, e o
DARF de um mês junta as vendas de todas as carteiras dele. O mês de apuração é
guardado no primeiro dia, e o banco recusa outro dia, para que dois pagamentos
do mesmo mês nunca deixem de se encontrar por uma data diferente.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c1e3a5b7d9f0'
down_revision: Union[str, None] = 'b8d0f2a4c6e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'darf_payment',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('user.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('revenue_code', sa.String(4), nullable=False),
        sa.Column('period', sa.Date(), nullable=False),
        sa.Column('paid_on', sa.Date(), nullable=False),
        sa.Column('principal', sa.Numeric(14, 2), nullable=False),
        sa.Column('fine', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('interest', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint('extract(day from period) = 1', name='ck_darf_payment_period_first_day'),
        sa.CheckConstraint('principal > 0', name='ck_darf_payment_principal_positive'),
        sa.CheckConstraint(
            'fine >= 0 AND interest >= 0', name='ck_darf_payment_charges_not_negative'
        ),
        schema='portfolio',
    )
    op.create_index(
        'ix_darf_payment_user_period',
        'darf_payment',
        ['user_id', 'period'],
        schema='portfolio',
    )


def downgrade() -> None:
    op.drop_index('ix_darf_payment_user_period', table_name='darf_payment', schema='portfolio')
    op.drop_table('darf_payment', schema='portfolio')
