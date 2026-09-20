"""Tirar os códigos ANBIMA de asset.fund

Revision ID: a3c5e7f9b1d2
Revises: f2b4d6e8a0c1
Create Date: 2026-09-17

`anbima_code` e `anbima_code_class` existiam para o `AnbimaClient` raspar
valores de cota do site da ANBIMA, e nada mais os lê: o formulário do admin
era o único lugar que os escrevia. O valor da cota agora vem da CVM, pelo
vínculo com o cadastro de fundos.

A classificação fica. `anbima_category` continua como reserva para o fundo
cadastrado à mão e para a classe cujo cadastro veio com a classificação
vazia — quem lê prefere a do cadastro quando ela existe. Por isso esta
migração não toca na coluna.

Inventário antes de remover (dump de produção de 2026-08-29): um fundo tinha
os códigos preenchidos (ativo 9, CNPJ 40.679.129/0001-92, F0000603155 e
C0000603155). O downgrade recria as colunas vazias; os valores não voltam.
"""

from alembic import op

revision = 'a3c5e7f9b1d2'
down_revision = 'f2b4d6e8a0c1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE asset.fund
            DROP COLUMN anbima_code,
            DROP COLUMN anbima_code_class;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE asset.fund
            ADD COLUMN anbima_code VARCHAR(12),
            ADD COLUMN anbima_code_class VARCHAR(12);
        """
    )
