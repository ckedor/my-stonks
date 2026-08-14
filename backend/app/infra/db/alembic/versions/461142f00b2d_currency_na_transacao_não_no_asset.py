"""currency na transacao não no asset

Revision ID: 461142f00b2d
Revises: 80e1566e31b5
Create Date: 2025-06-28 09:41:41.537703

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '461142f00b2d'
down_revision: Union[str, None] = '80e1566e31b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'broker', sa.Column('currency_id', sa.Integer(), nullable=True), schema='portfolio'
    )

    # 2. Criar foreign key
    op.create_foreign_key(
        'fk_broker_currency_id_currency',
        'broker',
        'currency',
        local_cols=['currency_id'],
        remote_cols=['id'],
        source_schema='portfolio',
        referent_schema='asset',
    )

    # 3. Atualizar os brokers existentes com currency_id = 1
    op.execute("""
        UPDATE portfolio.broker SET currency_id = 1
    """)

    # 4. Tornar a coluna NOT NULL
    op.alter_column('broker', 'currency_id', nullable=False, schema='portfolio')

    op.alter_column(
        'broker', 'cnpj', existing_type=sa.String(length=18), nullable=True, schema='portfolio'
    )


def downgrade() -> None:
    # 2. Remover a coluna currency_id de broker
    op.drop_constraint(
        'fk_broker_currency_id_currency', 'broker', schema='portfolio', type_='foreignkey'
    )
    op.drop_column('broker', 'currency_id', schema='portfolio')

    op.alter_column(
        'broker', 'cnpj', existing_type=sa.String(length=18), nullable=False, schema='portfolio'
    )
