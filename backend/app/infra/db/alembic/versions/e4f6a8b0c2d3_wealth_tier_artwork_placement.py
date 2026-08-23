"""Give each wealth tier's artwork its own placement.

Revision ID: e4f6a8b0c2d3
Revises: d3e5f7a9b1c2
Create Date: 2026-08-22
"""

import sqlalchemy as sa
from alembic import op

revision = 'e4f6a8b0c2d3'
down_revision = 'd3e5f7a9b1c2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Placement belongs to the drawing, not to the screen: every illustration
    # puts the character's feet at a different height inside its own file, so a
    # single offset in the layout is always wrong for some of them.
    op.add_column(
        'wealth_tier',
        sa.Column('artwork_offset', sa.Integer(), nullable=False, server_default='0'),
        schema='portfolio',
    )
    op.add_column(
        'wealth_tier',
        sa.Column('artwork_height', sa.Integer(), nullable=True),
        schema='portfolio',
    )


def downgrade() -> None:
    op.drop_column('wealth_tier', 'artwork_height', schema='portfolio')
    op.drop_column('wealth_tier', 'artwork_offset', schema='portfolio')
