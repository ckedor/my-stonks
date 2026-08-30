"""Drop the wealth-tier artwork columns.

A patente deixou de carregar o desenho de um personagem: agora ela é um
cenário, e os cenários são arquivos do repositório, servidos pelo front pela
posição do degrau na escala. Não há mais data URI para guardar, nem ajuste de
altura ou de linha de base — o cenário é um fundo, e o fundo não se calibra
por linha.

Revision ID: d3f5a7b9c1e4
Revises: c2e4f6a8b0d3
Create Date: 2026-08-29
"""

import sqlalchemy as sa
from alembic import op

revision = 'd3f5a7b9c1e4'
down_revision = 'c2e4f6a8b0d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('wealth_tier', 'artwork', schema='portfolio')
    op.drop_column('wealth_tier', 'artwork_offset', schema='portfolio')
    op.drop_column('wealth_tier', 'artwork_height', schema='portfolio')


def downgrade() -> None:
    op.add_column(
        'wealth_tier', sa.Column('artwork', sa.Text(), nullable=True), schema='portfolio'
    )
    op.add_column(
        'wealth_tier',
        sa.Column('artwork_offset', sa.Integer(), nullable=False, server_default='0'),
        schema='portfolio',
    )
    op.add_column(
        'wealth_tier', sa.Column('artwork_height', sa.Integer(), nullable=True), schema='portfolio'
    )
