"""Drop the per-portfolio setting that hid the wealth-tier artwork.

A arte deixou de ser opcional: ela aparece na tela de Patente, que existe
para isso, e não aparece no resumo. Sem os dois lugares em disputa, não há
escolha a guardar — a configuração só sobrava como um interruptor que não
mudava mais nada.

Revision ID: b1d3f5a7c9e2
Revises: a1c3e5f7b9d2
Create Date: 2026-08-29
"""

import sqlalchemy as sa
from alembic import op

revision = 'b1d3f5a7c9e2'
down_revision = 'a1c3e5f7b9d2'
branch_labels = None
depends_on = None

SETTING = 'wealth_tier_artwork'


def upgrade() -> None:
    # As escolhas gravadas saem primeiro: elas apontam para o nome, e apagar o
    # nome com filhas vivas deixaria a chave estrangeira sem destino.
    op.execute(
        sa.text("""
            DELETE FROM portfolio.user_configuration
            WHERE configuration_name_id IN (
                SELECT id FROM portfolio.configuration_name WHERE name = :name
            )
        """).bindparams(name=SETTING)
    )
    op.execute(
        sa.text('DELETE FROM portfolio.configuration_name WHERE name = :name').bindparams(
            name=SETTING
        )
    )


def downgrade() -> None:
    configuration_name = sa.table(
        'configuration_name',
        sa.column('name', sa.String),
        schema='portfolio',
    )
    op.bulk_insert(configuration_name, [{'name': SETTING}])
