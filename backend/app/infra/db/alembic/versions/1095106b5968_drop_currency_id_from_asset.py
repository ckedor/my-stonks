"""drop currency_id from asset

Revision ID: 1095106b5968
Revises: d1e2f3a4b5c6
Create Date: 2026-04-04 19:43:38.724049

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '1095106b5968'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('asset_currency_id_fkey', 'asset', schema='asset', type_='foreignkey')
    op.drop_column('asset', 'currency_id', schema='asset')


def downgrade() -> None:
    op.add_column('asset', sa.Column('currency_id', sa.Integer(), nullable=True), schema='asset')
    op.create_foreign_key(
        'asset_currency_id_fkey',
        'asset',
        'currency',
        ['currency_id'],
        ['id'],
        source_schema='asset',
        referent_schema='asset',
    )
