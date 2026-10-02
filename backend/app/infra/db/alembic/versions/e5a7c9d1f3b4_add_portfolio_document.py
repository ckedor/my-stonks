"""add portfolio document

Revision ID: e5a7c9d1f3b4
Revises: d3f5b7c9e1a2
Create Date: 2026-10-01 10:00:00.000000

O PDF enviado à carteira — nota de corretagem ou extrato de posição — passa a
ser guardado. Os bytes vão para o storage; aqui ficam os metadados e a chave
sob a qual eles estão.

O documento é único por carteira, finalidade e conteúdo (sha256): enviar o
mesmo arquivo de novo não cria outra linha. A nota ganha a referência ao
documento de onde foi lida, e perde só a referência (SET NULL) se o documento
for apagado — a nota continua tendo sido importada.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e5a7c9d1f3b4'
down_revision: Union[str, None] = 'd3f5b7c9e1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'document',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'portfolio_id', sa.Integer(), sa.ForeignKey('portfolio.portfolio.id'), nullable=False
        ),
        sa.Column('kind', sa.String(30), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('sha256', sa.String(64), nullable=False),
        sa.Column('storage_key', sa.String(255), nullable=False),
        sa.Column(
            'uploaded_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "kind IN ('brokerage_note', 'position_statement')", name='ck_document_kind'
        ),
        sa.UniqueConstraint('portfolio_id', 'kind', 'sha256', name='uq_document_by_content'),
        schema='portfolio',
    )
    with op.batch_alter_table('brokerage_note', schema='portfolio') as batch_op:
        batch_op.add_column(sa.Column('document_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_brokerage_note_document',
            'document',
            ['document_id'],
            ['id'],
            referent_schema='portfolio',
            ondelete='SET NULL',
        )
        batch_op.create_index('ix_portfolio_brokerage_note_document_id', ['document_id'])


def downgrade() -> None:
    with op.batch_alter_table('brokerage_note', schema='portfolio') as batch_op:
        batch_op.drop_index('ix_portfolio_brokerage_note_document_id')
        batch_op.drop_constraint('fk_brokerage_note_document', type_='foreignkey')
        batch_op.drop_column('document_id')
    op.drop_table('document', schema='portfolio')
