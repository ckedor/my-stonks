"""adicionando cor no custom category

Revision ID: aaaf7e631ca4
Revises: d49bf7734964
Create Date: 2025-04-18 16:30:16.594186

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'aaaf7e631ca4'
down_revision: Union[str, None] = 'd49bf7734964'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'custom_category',
        sa.Column('color', sa.String(length=7), nullable=False, server_default='#000000'),
        schema='portfolio',
    )


def downgrade() -> None:
    op.drop_column('custom_category', 'color', schema='portfolio')
