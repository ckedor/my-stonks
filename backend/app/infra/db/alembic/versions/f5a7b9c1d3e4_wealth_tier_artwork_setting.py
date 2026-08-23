"""Register the per-portfolio setting that reveals the wealth-tier artwork.

Revision ID: f5a7b9c1d3e4
Revises: e4f6a8b0c2d3
Create Date: 2026-08-22
"""

import sqlalchemy as sa
from alembic import op

revision = 'f5a7b9c1d3e4'
down_revision = 'e4f6a8b0c2d3'
branch_labels = None
depends_on = None

SETTING = 'wealth_tier_artwork'


def upgrade() -> None:
    # No row is created for any portfolio: an absent configuration already reads
    # as disabled, which is the default the artwork is meant to have. Seeding
    # rows here would also miss every portfolio created afterwards.
    configuration_name = sa.table(
        'configuration_name',
        sa.column('name', sa.String),
        schema='portfolio',
    )
    op.bulk_insert(configuration_name, [{'name': SETTING}])


def downgrade() -> None:
    op.execute(
        sa.text('DELETE FROM portfolio.configuration_name WHERE name = :name').bindparams(
            name=SETTING
        )
    )
