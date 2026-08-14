"""benchmark na custom category

Revision ID: ff4534ee2b55
Revises: 9307454660f4
Create Date: 2025-04-18 18:16:57.470386

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ff4534ee2b55'
down_revision: Union[str, None] = '9307454660f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'custom_category',
        sa.Column('benchmark_id', sa.Integer(), nullable=True),
        schema='portfolio',
    )
    op.create_foreign_key(
        'fk_custom_category_benchmark_id',
        source_table='custom_category',
        referent_table='index',
        local_cols=['benchmark_id'],
        remote_cols=['id'],
        source_schema='portfolio',
        referent_schema='market_data',
    )


def downgrade() -> None:
    op.drop_constraint(
        'fk_custom_category_benchmark_id',
        table_name='custom_category',
        schema='portfolio',
        type_='foreignkey',
    )
    op.drop_column('custom_category', 'benchmark_id', schema='portfolio')
