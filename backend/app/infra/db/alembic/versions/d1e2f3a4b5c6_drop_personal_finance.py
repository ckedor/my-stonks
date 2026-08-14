"""drop personal_finance schema and tables

Revision ID: d1e2f3a4b5c6
Revises: b9c7d8e1f2a3
Create Date: 2026-04-04 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'b9c7d8e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_pf_expense_user_date', table_name='expense', schema='personal_finance')
    op.drop_index('ix_pf_income_user_date', table_name='income', schema='personal_finance')
    op.drop_table('expense', schema='personal_finance')
    op.drop_table('income', schema='personal_finance')
    op.drop_table('subcategory', schema='personal_finance')
    op.drop_table('category', schema='personal_finance')
    op.execute('DROP SCHEMA IF EXISTS personal_finance')


def downgrade() -> None:
    pass
