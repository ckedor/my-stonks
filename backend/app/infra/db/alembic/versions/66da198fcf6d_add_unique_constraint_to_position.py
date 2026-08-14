"""add unique constraint to position

Revision ID: 66da198fcf6d
Revises: 461142f00b2d
Create Date: 2025-08-01 17:04:33.472344

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '66da198fcf6d'
down_revision: Union[str, None] = '461142f00b2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        constraint_name='uq_position_by_portfolio_asset_date',
        table_name='position',
        columns=['portfolio_id', 'asset_id', 'date'],
        schema='portfolio',
    )


def downgrade() -> None:
    op.drop_constraint(
        constraint_name='uq_position_by_portfolio_asset_date',
        table_name='position',
        schema='portfolio',
        type_='unique',
    )
