"""create personal_finance schema and tables

Revision ID: a1b2c3d4e5f6
Revises: ff4534ee2b55
Create Date: 2026-02-28 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '51e65fde73ba'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create schema
    op.execute('CREATE SCHEMA IF NOT EXISTS personal_finance')

    # Category table
    op.create_table(
        'category',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('public.user.id'), nullable=False),
        schema='personal_finance',
    )

    # Subcategory table
    op.create_table(
        'subcategory',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column(
            'category_id',
            sa.Integer(),
            sa.ForeignKey('personal_finance.category.id', ondelete='CASCADE'),
            nullable=False,
        ),
        schema='personal_finance',
    )

    # Expense table
    op.create_table(
        'expense',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('description', sa.String(200), nullable=True),
        sa.Column(
            'subcategory_id',
            sa.Integer(),
            sa.ForeignKey('personal_finance.subcategory.id'),
            nullable=False,
        ),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('public.user.id'), nullable=False),
        schema='personal_finance',
    )

    # Income table
    op.create_table(
        'income',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('description', sa.String(200), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('public.user.id'), nullable=False),
        schema='personal_finance',
    )

    # Indexes for fast monthly queries
    op.create_index(
        'ix_pf_expense_user_date',
        'expense',
        ['user_id', 'date'],
        schema='personal_finance',
    )
    op.create_index(
        'ix_pf_income_user_date',
        'income',
        ['user_id', 'date'],
        schema='personal_finance',
    )


def downgrade() -> None:
    op.drop_index('ix_pf_income_user_date', table_name='income', schema='personal_finance')
    op.drop_index('ix_pf_expense_user_date', table_name='expense', schema='personal_finance')
    op.drop_table('income', schema='personal_finance')
    op.drop_table('expense', schema='personal_finance')
    op.drop_table('subcategory', schema='personal_finance')
    op.drop_table('category', schema='personal_finance')
    op.execute('DROP SCHEMA IF EXISTS personal_finance')
