"""Guarda o logo do ativo junto do ativo.

O provedor devolve a URL do logo no catálogo, e até aqui ela morria no
payload: a tela do mercado a via, a lista de ativos do app não. Guardar a URL
— e não a imagem — mantém a tabela leve e deixa o cache do navegador fazer o
trabalho que ele já faz bem.

Revision ID: c2e4f6a8b0d3
Revises: b1d3f5a7c9e2
Create Date: 2026-08-29
"""

import sqlalchemy as sa
from alembic import op

revision = 'c2e4f6a8b0d3'
down_revision = 'b1d3f5a7c9e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'asset',
        sa.Column('logo_url', sa.String(length=500), nullable=True),
        schema='asset',
    )


def downgrade() -> None:
    op.drop_column('asset', 'logo_url', schema='asset')
