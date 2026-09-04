"""Criar o schema lab: carteira teórica e suas posições

Revision ID: e1a3c5d7f9b2
Revises: d5f7a9c1e3b8
Create Date: 2026-08-31

Uma carteira teórica é do usuário e não é uma carteira: não tem operação, não
tem posição e nada nela é consolidado. Schema próprio pelo mesmo motivo que o
research tem o dele — o que mora em `portfolio` é o que tem história de
compra e venda atrás.

O que se guarda aqui é parâmetro: nome, pesos, valor inicial, regime de aporte
e de rebalanceamento. Curva de rentabilidade, patrimônio simulado e análise de
risco não têm coluna nenhuma, de propósito: saem de um backtest sob demanda
sobre cotações que já estão no banco, e persistir o derivado criaria uma
segunda verdade para invalidar toda vez que uma cotação nova chegasse.

`theoretical_position` vira preço por um caminho só, e os dois CHECKs recusam o
meio-termo. Ou a linha aponta para um ativo cadastrado — e o preço vem das
cotações dele —, ou não aponta, e aí traz uma série de mercado, um tipo de
rentabilidade, ou os dois: a série sozinha é exposição ao índice (o IBOVESPA, o
S&P 500), a série com tipo e taxa é renda fixa sintética (110% do CDI, IPCA +
6%), e o tipo sem série é um prefixado, que não acompanha índice nenhum. A
renda fixa sintética é como o laboratório representa um CDB ou um Tesouro:
instrumentos assim não têm cotação nenhuma, e sem esse lado a carteira teórica
só saberia falar de renda variável.

O descadastro de um ativo apaga a linha (`CASCADE`) em vez de anular o vínculo,
ao contrário do que a posição recomendada faz. Lá a linha sobrevive porque o
ticker é o que o relatório disse; aqui uma linha sem ativo não vira preço, e
mantê-la faria a simulação rodar com uma fatia de caixa que ninguém pediu. Os
pesos que sobram são normalizados na hora de simular.
"""

from alembic import op

revision = 'e1a3c5d7f9b2'
down_revision = 'd5f7a9c1e3b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE SCHEMA IF NOT EXISTS lab;')

    op.execute(
        """
        CREATE TABLE lab.theoretical_portfolio (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
            name VARCHAR(120) NOT NULL,
            initial_amount DOUBLE PRECISION NOT NULL DEFAULT 10000,
            contribution_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
            contribution_frequency VARCHAR(20) NOT NULL DEFAULT 'none',
            rebalance_frequency VARCHAR(20) NOT NULL DEFAULT 'none',
            benchmark_id INTEGER
                REFERENCES market_data.market_data_series(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_theoretical_portfolio_name UNIQUE (user_id, name)
        );
        """
    )
    op.execute('CREATE INDEX ix_theoretical_portfolio_user ON lab.theoretical_portfolio (user_id);')

    op.execute(
        """
        CREATE TABLE lab.theoretical_position (
            id SERIAL PRIMARY KEY,
            theoretical_portfolio_id INTEGER NOT NULL
                REFERENCES lab.theoretical_portfolio(id) ON DELETE CASCADE,
            asset_id INTEGER REFERENCES asset.asset(id) ON DELETE CASCADE,
            series_id INTEGER
                REFERENCES market_data.market_data_series(id) ON DELETE CASCADE,
            fixed_income_type_id INTEGER REFERENCES asset.fixed_income_type(id),
            rate DOUBLE PRECISION,
            label VARCHAR(80),
            weight DOUBLE PRECISION NOT NULL,
            CONSTRAINT ck_theoretical_position_source CHECK (
                (asset_id IS NOT NULL AND series_id IS NULL
                    AND fixed_income_type_id IS NULL AND rate IS NULL)
                OR (asset_id IS NULL AND (series_id IS NOT NULL
                    OR fixed_income_type_id IS NOT NULL))
            ),
            CONSTRAINT ck_theoretical_position_rate CHECK (
                (fixed_income_type_id IS NULL) = (rate IS NULL)
            ),
            CONSTRAINT uq_theoretical_position_asset
                UNIQUE (theoretical_portfolio_id, asset_id)
        );
        """
    )
    op.execute(
        'CREATE INDEX ix_theoretical_position_portfolio'
        ' ON lab.theoretical_position (theoretical_portfolio_id);'
    )


def downgrade() -> None:
    op.execute('DROP TABLE IF EXISTS lab.theoretical_position;')
    op.execute('DROP TABLE IF EXISTS lab.theoretical_portfolio;')
    op.execute('DROP SCHEMA IF EXISTS lab;')
