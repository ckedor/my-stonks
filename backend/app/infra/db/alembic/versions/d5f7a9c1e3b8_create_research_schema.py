"""Criar o schema research: fonte, carteira recomendada e suas posições

Revision ID: d5f7a9c1e3b8
Revises: d8f0b2c4e6a9
Create Date: 2026-08-30

Uma carteira recomendada é publicada por uma casa de análise, refere-se a um
mês e vale para todo mundo — não é de um usuário nem de uma carteira. Por isso
schema próprio, e por isso `reference_date` é coluna e não data de upload: é
dela que qualquer medição posterior de desempenho vai partir.

`recommended_position.asset_id` é anulável de propósito. O relatório nomeia
tickers, e um ticker que o catálogo ainda não tem continua fazendo parte da
recomendação: descartar a linha mudaria em silêncio o peso das que ficaram. Pelo
mesmo motivo o descadastro de um ativo apaga o vínculo (`SET NULL`) e não a
linha.
"""

from alembic import op

revision = 'd5f7a9c1e3b8'
down_revision = 'd8f0b2c4e6a9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE SCHEMA IF NOT EXISTS research;')

    op.execute(
        """
        CREATE TABLE research.research_source (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            slug VARCHAR(120) NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )

    op.execute(
        """
        CREATE TABLE research.recommended_portfolio (
            id SERIAL PRIMARY KEY,
            source_id INTEGER NOT NULL
                REFERENCES research.research_source(id) ON DELETE RESTRICT,
            title VARCHAR(200) NOT NULL,
            reference_date DATE NOT NULL,
            summary TEXT,
            objective TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_recommended_portfolio_edition
                UNIQUE (source_id, title, reference_date)
        );
        """
    )
    op.execute(
        'CREATE INDEX ix_recommended_portfolio_reference_date '
        'ON research.recommended_portfolio (reference_date);'
    )

    op.execute(
        """
        CREATE TABLE research.recommended_position (
            id SERIAL PRIMARY KEY,
            recommended_portfolio_id INTEGER NOT NULL
                REFERENCES research.recommended_portfolio(id) ON DELETE CASCADE,
            asset_id INTEGER REFERENCES asset.asset(id) ON DELETE SET NULL,
            ticker VARCHAR(30) NOT NULL,
            name VARCHAR(200),
            weight DOUBLE PRECISION NOT NULL,
            rationale TEXT,
            target_price DOUBLE PRECISION,
            change VARCHAR(20),
            CONSTRAINT uq_recommended_position_ticker
                UNIQUE (recommended_portfolio_id, ticker)
        );
        """
    )


def downgrade() -> None:
    op.execute('DROP TABLE IF EXISTS research.recommended_position;')
    op.execute('DROP TABLE IF EXISTS research.recommended_portfolio;')
    op.execute('DROP TABLE IF EXISTS research.research_source;')
    op.execute('DROP SCHEMA IF EXISTS research;')
