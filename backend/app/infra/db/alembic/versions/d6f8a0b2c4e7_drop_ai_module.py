"""Dropar o schema ai: o módulo de IA sai para ser refeito do zero

Revision ID: d6f8a0b2c4e7
Revises: c4e6a8b0d2f5
Create Date: 2026-09-05

O módulo tinha uma funcionalidade só — o contexto ativo de um ativo — e ela
estava morta: nada na tela chamava, e os artefatos guardados eram cache de uma
resposta que ninguém lia. Guardar as tabelas "por precaução" só faria a próxima
versão herdar um formato que foi desenhado para outra coisa.

O que fica é a integração com a OpenAI, que não é do módulo: o contrato do
provedor mora agora em `app/infra/openai/provider.py`, e quem usa é o extrator
de carteiras recomendadas.
"""

from alembic import op

revision = 'd6f8a0b2c4e7'
down_revision = 'c4e6a8b0d2f5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('DROP TABLE IF EXISTS ai.ai_artifact;')
    op.execute('DROP TABLE IF EXISTS ai.ai_feature;')
    # A v1 criava um trigger de updated_at, e a função dele sobrevive à queda
    # das tabelas. Sem derrubá-la, o DROP SCHEMA falha por dependência num
    # banco que já rodou a v1 — que é todo banco que existe hoje.
    op.execute('DROP FUNCTION IF EXISTS ai.set_ai_feature_updated_at() CASCADE;')
    op.execute('DROP SCHEMA IF EXISTS ai CASCADE;')


def downgrade() -> None:
    raise NotImplementedError(
        'O módulo de IA foi removido para ser refeito. Restaurar o formato '
        'antigo não é o caminho de volta: a versão nova terá o seu.'
    )
