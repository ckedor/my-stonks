"""add fee to treasury_bond

Revision ID: e7a1f2b3c4d5
Revises: b3c4d5e6f7a8
Create Date: 2026-03-17 11:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e7a1f2b3c4d5'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('treasury_bond', schema='asset') as batch_op:
        batch_op.add_column(sa.Column('fee', sa.Numeric(8, 5), nullable=True))

    # Seed fees dos títulos existentes
    op.execute(
        sa.text('UPDATE asset.treasury_bond SET fee = 0.0614 WHERE id = 1')
    )  # NTNB 2032 (IPCA+ 6,14%)
    op.execute(
        sa.text('UPDATE asset.treasury_bond SET fee = 0.1082 WHERE id = 2')
    )  # NTNF 2031 (Prefixado 10,82%)


def downgrade() -> None:
    with op.batch_alter_table('treasury_bond', schema='asset') as batch_op:
        batch_op.drop_column('fee')
