"""Tipo da carteira recomendada, como cadastro editável

Revision ID: c4e6a8b0d2f5
Revises: e1a3c5d7f9b2
Create Date: 2026-09-05

O tipo é tabela e não enum no código porque a lista é do mantenedor: uma casa
que passa a publicar uma carteira de um tipo novo é um cadastro na tela de
admin, não uma migration. O slug é o que impede "ETF Global" e "etf global" de
virarem dois tipos.

`recommended_portfolio.type_id` é anulável: as edições importadas antes da
lista existir não têm tipo, e apagar um tipo do cadastro não pode levar a
edição junto (`SET NULL`).
"""

from alembic import op

revision = 'c4e6a8b0d2f5'
down_revision = 'e1a3c5d7f9b2'
branch_labels = None
depends_on = None

PRESET = [
    ('FII', 'fii'),
    ('Ações Brasil', 'acoes-brasil'),
    ('Ações Global', 'acoes-global'),
    ('ETF Brasil', 'etf-brasil'),
    ('ETF Global', 'etf-global'),
    ('Mundo', 'mundo'),
    ('Renda Fixa', 'renda-fixa'),
    ('Cripto', 'cripto'),
]


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE research.recommended_portfolio_type (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            slug VARCHAR(120) NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )

    values = ', '.join(f"('{name}', '{slug}')" for name, slug in PRESET)
    op.execute(
        f'INSERT INTO research.recommended_portfolio_type (name, slug) VALUES {values};'
    )

    op.execute(
        """
        ALTER TABLE research.recommended_portfolio
            ADD COLUMN type_id INTEGER
                REFERENCES research.recommended_portfolio_type(id) ON DELETE SET NULL;
        """
    )


def downgrade() -> None:
    op.execute('ALTER TABLE research.recommended_portfolio DROP COLUMN type_id;')
    op.execute('DROP TABLE research.recommended_portfolio_type;')
