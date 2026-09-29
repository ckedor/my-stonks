"""add dividend kind

Revision ID: d3f5b7c9e1a2
Revises: c1e3a5b7d9f0
Create Date: 2026-09-29 18:00:00.000000

O provento ganha o tipo: dividendo ou JCP. Para a carteira os dois são dinheiro
que entrou, e por isso nada distinguia um do outro. Para a declaração não são a
mesma coisa — o dividendo vai para Rendimentos Isentos e o JCP para Tributação
Exclusiva —, e só quem cadastrou sabe qual dos dois a empresa pagou.

Todo provento existente passa a ser dividendo, que é o que a declaração vinha
supondo. Um JCP lançado antes precisa ser corrigido na tela de proventos.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd3f5b7c9e1a2'
down_revision: Union[str, None] = 'c1e3a5b7d9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'dividend',
        sa.Column('kind', sa.String(20), nullable=False, server_default='dividend'),
        schema='portfolio',
    )
    op.create_check_constraint(
        'ck_dividend_kind',
        'dividend',
        "kind IN ('dividend', 'interest_on_equity')",
        schema='portfolio',
    )


def downgrade() -> None:
    op.drop_constraint('ck_dividend_kind', 'dividend', schema='portfolio', type_='check')
    op.drop_column('dividend', 'kind', schema='portfolio')
