"""Drop the wealth-tier table.

A escala virou código. Cada degrau tem um cenário desenhado para ele em
`frontend/src/assets/tiers`, e a imagem só existe porque o degrau existe:
renomear ou reordenar uma linha desalinhava a galeria inteira, com metade do
par versionada e a outra metade não. Fixa em `domain.wealth_tier_ladder`, o
título e o arquivo andam no mesmo commit — e não sobra nada para uma tabela
guardar.

Revision ID: e5a7c9b1d3f6
Revises: d3f5a7b9c1e4
Create Date: 2026-08-29
"""

import sqlalchemy as sa
from alembic import op

revision = 'e5a7c9b1d3f6'
down_revision = 'd3f5a7b9c1e4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table('wealth_tier', schema='portfolio')


def downgrade() -> None:
    op.create_table(
        'wealth_tier',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('rank', sa.Integer(), nullable=False, unique=True),
        sa.Column('name', sa.String(length=50), nullable=False, unique=True),
        sa.Column('threshold', sa.Float(), nullable=False, unique=True),
        schema='portfolio',
    )
