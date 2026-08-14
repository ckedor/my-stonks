"""add_cagr_columns_to_position

Revision ID: 610fba96aaf5
Revises: f8a9b0c1d2e3
Create Date: 2026-03-31 11:55:27.276967

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '610fba96aaf5'
down_revision: Union[str, None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('position', sa.Column('cagr', sa.Float(), nullable=True), schema='portfolio')
    op.add_column('position', sa.Column('cagr_usd', sa.Float(), nullable=True), schema='portfolio')


def downgrade() -> None:
    op.drop_column('position', 'cagr_usd', schema='portfolio')
    op.drop_column('position', 'cagr', schema='portfolio')
