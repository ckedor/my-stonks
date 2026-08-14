"""rebalancing

Revision ID: 51e65fde73ba
Revises: 2ce91a1f52d2
Create Date: 2026-02-11 06:25:50.608042

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '51e65fde73ba'
down_revision: Union[str, None] = '2ce91a1f52d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'custom_category',
        sa.Column('target_percentage', sa.Float(), nullable=True),
        schema='portfolio',
    )
    op.add_column(
        'custom_category_assignment',
        sa.Column('target_percentage', sa.Float(), nullable=True),
        schema='portfolio',
    )


def downgrade() -> None:
    op.drop_column('custom_category_assignment', 'target_percentage', schema='portfolio')
    op.drop_column('custom_category', 'target_percentage', schema='portfolio')
