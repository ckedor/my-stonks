"""Create the wealth-tier ladder and seed its default rungs.

Revision ID: d3e5f7a9b1c2
Revises: c2d4e6f8a0b1
Create Date: 2026-08-22
"""

import sqlalchemy as sa
from alembic import op

revision = 'd3e5f7a9b1c2'
down_revision = 'c2d4e6f8a0b1'
branch_labels = None
depends_on = None

# The starting ladder, not the definition of one: rungs are added, renamed, and
# repriced through the admin CRUD, so this list is a seed and never a source of
# truth the application reads back.
SEED_TIERS = [
    (1, 'Pedinte', 0.0),
    (2, 'Andarilho', 50_000.0),
    (3, 'Camponês', 100_000.0),
    (4, 'Mercador', 200_000.0),
    (5, 'Escudeiro', 300_000.0),
    (6, 'Cavaleiro', 400_000.0),
    (7, 'Barão', 500_000.0),
    (8, 'Nobre', 750_000.0),
    (9, 'Duque', 1_000_000.0),
    (10, 'Rei', 1_500_000.0),
    (11, 'Imperador', 2_000_000.0),
]


def upgrade() -> None:
    wealth_tier = op.create_table(
        'wealth_tier',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rank', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('threshold', sa.Float(), nullable=False),
        sa.Column('artwork', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('rank', name='uq_wealth_tier_rank'),
        sa.UniqueConstraint('name', name='uq_wealth_tier_name'),
        sa.UniqueConstraint('threshold', name='uq_wealth_tier_threshold'),
        schema='portfolio',
    )

    op.bulk_insert(
        wealth_tier,
        [
            {'rank': rank, 'name': name, 'threshold': threshold, 'artwork': None}
            for rank, name, threshold in SEED_TIERS
        ],
    )


def downgrade() -> None:
    op.drop_table('wealth_tier', schema='portfolio')
