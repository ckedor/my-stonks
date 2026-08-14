from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM

from alembic import op

revision: str = '80e1566e31b5'
down_revision: Union[str, None] = '36e24bdb0b9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    bind = op.get_bind()

    # Cria tabela com os tipos de configuração possíveis
    op.create_table(
        'configuration_name',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(64), nullable=False, unique=True),
        schema='portfolio',
    )

    # Cria tabela principal
    op.create_table(
        'user_configuration',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column(
            'portfolio_id',
            sa.Integer,
            sa.ForeignKey('portfolio.portfolio.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'configuration_name_id',
            sa.Integer,
            sa.ForeignKey('portfolio.configuration_name.id'),
            nullable=False,
        ),
        sa.Column('enabled', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('config_data', sa.JSON, nullable=True),
        schema='portfolio',
    )

    # Seed dos nomes
    bind.execute(
        sa.text("""
        INSERT INTO portfolio.configuration_name (name)
        VALUES 
            ('foxbit_integration'),
            ('fiis_dividends_integration')
        ON CONFLICT DO NOTHING
    """)
    )

    # Mapeia nomes -> ids
    result = bind.execute(sa.text('SELECT id, name FROM portfolio.configuration_name'))
    name_map = {row.name: row.id for row in result.fetchall()}

    # Insere configurações por portfolio
    portfolios = bind.execute(sa.text('SELECT id FROM portfolio.portfolio')).fetchall()
    for portfolio in portfolios:
        for name, config_id in name_map.items():
            bind.execute(
                sa.text("""
                    INSERT INTO portfolio.user_configuration (portfolio_id, configuration_name_id, enabled, config_data)
                    VALUES (:portfolio_id, :config_id, false, '{}')
                """),
                {'portfolio_id': portfolio.id, 'config_id': config_id},
            )


def downgrade():
    op.drop_table('user_configuration', schema='portfolio')
    op.drop_table('configuration_name', schema='portfolio')
