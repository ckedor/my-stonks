"""initial seed

Revision ID: 2abd11219338
Revises: edcb48322b3a
Create Date: 2025-03-26 19:52:33.190801

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '2abd11219338'
down_revision: Union[str, None] = 'edcb48322b3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # Moedas
    bind.execute(
        sa.text(
            """
            INSERT INTO asset.currency (id, code, name) VALUES
                (1, 'BRL', 'Real'),
                (2, 'USD', 'Dólar')
            ON CONFLICT DO NOTHING
            """
        )
    )
    bind.execute(
        sa.text(
            """
            SELECT setval('asset.currency_id_seq', (SELECT MAX(id) FROM asset.currency));
            """
        )
    )

    # Asset Classes
    bind.execute(
        sa.text(
            """
            INSERT INTO asset.asset_class (id, name) VALUES
                (1, 'Renda Fixa'),
                (2, 'Tesouro Direto'),
                (3, 'Renda Variável'),
                (4, 'Previdência'),
                (5, 'Criptoativos')
            ON CONFLICT DO NOTHING
            """
        )
    )
    bind.execute(
        sa.text(
            """
            SELECT setval('asset.asset_class_id_seq', (SELECT MAX(id) FROM asset.asset_class));
            """
        )
    )

    # Asset Types
    bind.execute(
        sa.text(
            """
            INSERT INTO asset.asset_type (id, short_name, name, asset_class_id) VALUES
                (1, 'ETF', 'Exchange Traded Fund', 3),
                (2, 'FII', 'Fundo de Investimento Imobiliário', 3),
                (3, 'Tesouro', 'Tesouro Direto', 1),
                (4, 'Ação', 'Ação', 3),
                (5, 'BDR', 'Brazilian Depositary Receipts', 3),
                (6, 'Previdência', 'Fundo de Previdência', 4),
                (7, 'FI', 'Fundo de Investimento', 3),
                (8, 'CDB', 'Certificado de Depósito Bancário', 1),
                (9, 'Debênture', 'Debênture', 1),
                (10, 'CRI', 'Certificado de Recebíveis Imobiliários', 1),
                (11, 'CRA', 'Certificado de Recebíveis do Agronegócio', 1),
                (12, 'REIT', 'Real Estate Investment Trust', 3),
                (13, 'Cripto', 'Criptoativos', 5)
            ON CONFLICT DO NOTHING
            """
        )
    )
    bind.execute(
        sa.text(
            """
            SELECT setval('asset.asset_type_id_seq', (SELECT MAX(id) FROM asset.asset_type));
            """
        )
    )

    # Fixed Income Types
    bind.execute(
        sa.text(
            """
            INSERT INTO asset.fixed_income_type (id, name, description) VALUES
                (1, 'Prefixado', 'Renda Fixa Pré-Fixada'),
                (2, 'Index+', 'Renda Fixa Pós-Fixada Indexada a Índice'),
                (3, '%Index', 'Renda Fixa Pós-Fixada Percentual de Índice')
            ON CONFLICT DO NOTHING
            """
        )
    )
    bind.execute(
        sa.text(
            """
            SELECT setval('asset.fixed_income_type_id_seq', (SELECT MAX(id) FROM asset.fixed_income_type));
            """
        )
    )

    # Market Data Indexes
    bind.execute(
        sa.text(
            """
            INSERT INTO market_data.index (id, symbol, short_name, name, currency_id) VALUES
                (1, 'USD/BRL', 'USD/BRL', 'Dólar x Real', NULL),
                (2, 'IPCA', 'IPCA', 'Índice de Preços ao Consumidor Amplo', 1),
                (3, 'CDI', 'CDI', 'Certificado de Depósito Interbancário', 1),
                (4, 'IFIX.SA', 'IFIX', 'Índice de Fundos Imobiliários', 1),
                (5, '^GSPC', 'S&P500', 'Standard & Poor''s 500', 2),
                (6, '^BVSP', 'IBOVESPA', 'Índice Bovespa', 1),
                (7, '^IXIC', 'NASDAQ', 'NASDAQ Composite', 2)
            ON CONFLICT DO NOTHING
            """
        )
    )
    bind.execute(
        sa.text(
            """
            SELECT setval('market_data.index_id_seq', (SELECT MAX(id) FROM market_data.index));
            """
        )
    )

    # FII Types
    tipos = ['Tijolo', 'Papel', 'Híbrido', 'Fundo de Fundos', 'Desenvolvimento']
    for name in tipos:
        op.execute(
            sa.text(
                'INSERT INTO asset.fii_type (name) VALUES (:name) ON CONFLICT (name) DO NOTHING'
            ).bindparams(name=name)
        )

    # FII Segments
    segmentos = [
        ('Shoppings', 'Tijolo'),
        ('Lajes Corporativas', 'Tijolo'),
        ('Galpões Logísticos', 'Tijolo'),
        ('Hospitais', 'Tijolo'),
        ('Educacional', 'Tijolo'),
        ('Agências Bancárias', 'Tijolo'),
        ('Híbrido', 'Híbrido'),
        ('Papéis', 'Papel'),
        ('Fundos de Fundos', 'Fundo de Fundos'),
        ('Desenvolvimento', 'Desenvolvimento'),
    ]

    for name, tipo in segmentos:
        op.execute(
            sa.text(
                """
                INSERT INTO asset.fii_segment (name, type_id)
                SELECT :name, id FROM asset.fii_type WHERE name = :tipo
                ON CONFLICT (name) DO NOTHING
                """
            ).bindparams(name=name, tipo=tipo)
        )
    bind.execute(
        sa.text("""
            INSERT INTO asset.etf_segment (id, name) VALUES
            (1, 'ETFs de Ações Brasil'),
            (2, 'ETFs de Ações Internacionais'),
            (3, 'ETFs de Renda Fixa'),
            (4, 'ETFs de Commodities'),
            (5, 'ETFs de Setores Específicos'),
            (6, 'ETFs de Sustentabilidade e Governança (ESG)');
        """)
    )

    bind.execute(
        sa.text(
            """
            SELECT setval('asset.etf_segment_id_seq', (SELECT MAX(id) FROM asset.etf_segment));
            """
        )
    )

    bind.execute(
        sa.text(
            """
            INSERT INTO asset.treasury_bond_type (id, code, name, description) VALUES
                (1, 'LFT', 'Tesouro Selic', 'Título pós-fixado, atrelado à taxa Selic.'),
                (2, 'LTN', 'Tesouro Prefixado', 'Título com taxa de juros prefixada, pago no vencimento.'),
                (3, 'NTN-F', 'Tesouro Prefixado com Juros Semestrais', 'Título com taxa de juros prefixada, com pagamento de juros semestrais.'),
                (4, 'NTN-B', 'Tesouro IPCA+ com Juros Semestrais', 'Título indexado ao IPCA, com pagamento de juros semestrais.'),
                (5, 'NTN-B Principal', 'Tesouro IPCA+', 'Título indexado ao IPCA, sem pagamento de juros periódicos.'),
                (6, 'NTN-C', 'Título de renda fixa indexado ao IGP-M', 'Título corrigido pelo IGP-M.')
            ON CONFLICT DO NOTHING
            """
        )
    )

    def __repr__(self):
        return self.name


def downgrade() -> None:
    """Downgrade schema."""
    pass
