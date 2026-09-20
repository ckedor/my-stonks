"""Replace the asset description feature with a draft for the registry text.

The old feature generated an answer of its own, on a weekly schedule, and the
screen read that answer. The registry now carries ``asset.summary`` and
``asset.description``, which belong to the maintainer: the model writes a draft
into the form and nothing reaches the database until somebody saves it.

The old artifacts go with the old feature. They are answers to a question that
is no longer asked, in a shape (`what_it_is`, `key_facts`, …) nothing renders
any more, and keeping them would leave rows whose prompt version points at a
feature that does not exist.

Revision ID: d8b2f4a6c0e1
Revises: c7e9a1b3d5f8
"""

from alembic import op

revision = 'd8b2f4a6c0e1'
down_revision = 'c7e9a1b3d5f8'
branch_labels = None
depends_on = None

_OLD_KEY = 'asset_description'
_NEW_KEY = 'asset_description_draft'


def upgrade() -> None:
    op.execute(f"""
        DELETE FROM ai.ai_artifact a
         USING ai.ai_prompt_version v, ai.ai_feature f
         WHERE a.prompt_version_id = v.id
           AND v.feature_id = f.id
           AND f.key = '{_OLD_KEY}'
    """)
    op.execute(f"""
        DELETE FROM ai.ai_prompt_version v
         USING ai.ai_feature f
         WHERE v.feature_id = f.id AND f.key = '{_OLD_KEY}'
    """)
    op.execute(f"DELETE FROM ai.ai_feature WHERE key = '{_OLD_KEY}'")
    _seed_draft_feature()


def _seed_draft_feature() -> None:
    """A feature nova e o prompt com que ela nasce.

    A validade é manual e, na prática, irrelevante: nada lê o artefato por si.
    Ele é o rascunho que a tela joga no formulário, e o que persiste é o que o
    mantenedor salvar no cadastro do ativo.
    """
    op.execute(f"""
        INSERT INTO ai.ai_feature (key, name, description, freshness, ttl_hours)
        VALUES (
            '{_NEW_KEY}',
            'Rascunho da descrição do ativo',
            'Propõe o resumo e o texto de cadastro de um ativo. É rascunho: '
            'quem edita e salva é o mantenedor, e só o que ele salvar fica.',
            'manual',
            NULL
        );
    """)
    op.execute(f"""
        INSERT INTO ai.ai_prompt_version (
            feature_id, version, system, template, model,
            temperature, max_output_tokens, web_search, is_active, notes
        )
        SELECT
            f.id, 1,
            'Você escreve o texto de cadastro de instrumentos financeiros para um '
            || 'investidor pessoa física brasileiro, em português do Brasil, de forma '
            || 'direta e factual.' || E'\n\n'
            || 'Regras que não se negociam:' || E'\n'
            || '1. NÃO recomende, não avalie se está caro ou barato, não diga se vale a '
            || 'pena comprar, manter ou vender, e não projete preço. Você descreve.' || E'\n'
            || '2. Os números da seção DESEMPENHO vêm prontos. Use apenas esses, não '
            || 'calcule e não traga número de outra fonte. Um campo marcado como '
            || '"não medido" é dito como não disponível, nunca preenchido.' || E'\n'
            || '3. Os dados da seção CADASTRO são a verdade da aplicação. Se algo que '
            || 'você encontrar na web divergir deles, prevalece o cadastro.' || E'\n'
            || '4. Todo fato vindo da web precisa da URL de onde veio. Não invente '
            || 'link, título nem data.',
            'Escreva o texto de cadastro do ativo abaixo.' || E'\n\n'
            || 'IDENTIFICAÇÃO' || E'\n'
            || '- Código: {{ticker}}' || E'\n'
            || '- Nome: {{name}}' || E'\n'
            || '- Tipo: {{asset_type}}' || E'\n'
            || '- Bolsa: {{exchange}}' || E'\n\n'
            || 'CADASTRO' || E'\n'
            || '{{registry_facts}}' || E'\n\n'
            || 'DESEMPENHO (medido pela aplicação sobre as cotações persistidas)' || E'\n'
            || '{{performance}}' || E'\n\n'
            || 'Hoje é {{today}}. Pesquise na web o que o emissor ou o fundo faz e os '
            || 'fatos cadastrais que faltam acima.' || E'\n\n'
            || 'Preencha:' || E'\n'
            || '- summary: UMA frase dizendo o que o ativo é. No máximo 300 '
            || 'caracteres, porque ela aparece numa linha de lista.' || E'\n'
            || '- description: o texto da página do ativo, em Markdown. O que o '
            || 'instrumento é, o que faz, os fatos de cadastro relevantes e, quando '
            || 'houver números em DESEMPENHO, uma frase sobre eles dizendo o período '
            || 'a que se referem.' || E'\n'
            || '- sources: as páginas que você usou.',
            'gpt-4o', 0.2, 4000, TRUE, TRUE,
            'Versão inicial. Descritiva por construção: o schema não tem campo de '
            'recomendação, então não há onde uma caber.'
        FROM ai.ai_feature f
        WHERE f.key = '{_NEW_KEY}';
    """)


def downgrade() -> None:
    """Drops the draft feature. The old one is not rebuilt.

    Its artifacts were deleted on the way up and its output schema no longer
    exists in code, so recreating the row would describe a feature nothing can
    run.
    """
    op.execute(f"""
        DELETE FROM ai.ai_artifact a
         USING ai.ai_prompt_version v, ai.ai_feature f
         WHERE a.prompt_version_id = v.id
           AND v.feature_id = f.id
           AND f.key = '{_NEW_KEY}'
    """)
    op.execute(f"""
        DELETE FROM ai.ai_prompt_version v
         USING ai.ai_feature f
         WHERE v.feature_id = f.id AND f.key = '{_NEW_KEY}'
    """)
    op.execute(f"DELETE FROM ai.ai_feature WHERE key = '{_NEW_KEY}'")
