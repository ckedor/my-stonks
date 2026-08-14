"""add_total_invested_to_position

Revision ID: 87d535e79aef
Revises: 610fba96aaf5
Create Date: 2026-03-31 18:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '87d535e79aef'
down_revision: Union[str, None] = '610fba96aaf5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'position', sa.Column('total_invested', sa.Float(), nullable=True), schema='portfolio'
    )
    op.add_column(
        'position', sa.Column('total_invested_usd', sa.Float(), nullable=True), schema='portfolio'
    )


def downgrade() -> None:
    op.drop_column('position', 'total_invested_usd', schema='portfolio')
    op.drop_column('position', 'total_invested', schema='portfolio')
