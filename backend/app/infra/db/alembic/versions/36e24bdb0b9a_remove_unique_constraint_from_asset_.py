"""remove unique constraint from asset.name and asset.ticker

Revision ID: 36e24bdb0b9a
Revises: 2f36d1206720
Create Date: 2025-05-07 18:23:54.626294

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '36e24bdb0b9a'
down_revision: Union[str, None] = '2f36d1206720'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('asset', schema='asset') as batch_op:
        batch_op.drop_constraint('asset_name_key', type_='unique')
        batch_op.drop_constraint('asset_ticker_key', type_='unique')


def downgrade() -> None:
    with op.batch_alter_table('asset', schema='asset') as batch_op:
        batch_op.create_unique_constraint('asset_name_key', ['name'])
        batch_op.create_unique_constraint('asset_ticker_key', ['ticker'])
