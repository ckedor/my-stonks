"""Track the registry version to which fund terms were applied.

Revision ID: b4d6f8a0c2e3
Revises: a3c5e7f9b1d2
"""

import sqlalchemy as sa
from alembic import op

revision = 'b4d6f8a0c2e3'
down_revision = 'a3c5e7f9b1d2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'source_file',
        sa.Column('applied_registry_version', sa.String(64), nullable=True),
        schema='market_data',
    )


def downgrade() -> None:
    op.drop_column('source_file', 'applied_registry_version', schema='market_data')
