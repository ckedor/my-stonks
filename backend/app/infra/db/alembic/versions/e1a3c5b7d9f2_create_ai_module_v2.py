"""Criar o schema ai: feature, versão de prompt, artefato e execução

Revision ID: e1a3c5b7d9f2
Revises: d6f8a0b2c4e7
Create Date: 2026-09-05

A primeira versão deste módulo guardava feature e artefato, e servia resposta
velha por sete dias depois de um deploy que mudasse o prompt — porque o prompt
não fazia parte da identidade do artefato. Aqui ele faz: a chave única de
`ai_artifact` é (feature, versão do prompt, hash da entrada). Ativar uma versão
nova aposenta sozinha o que a anterior gerou, sem job de invalidação, e as
respostas antigas continuam na tabela, o que dá comparação entre versões de
graça.

`ai_prompt_version` é imutável: editar um prompt escreve a próxima versão e a
ativa. Reescrever o texto de uma versão mudaria em silêncio o significado de
toda resposta já gravada sob ela. O índice parcial garante uma ativa por
feature, porque com duas a leitura passaria a depender de qual linha o SELECT
devolvesse primeiro.

`ai_artifact.expires_at` é nulo quando a feature só sai por refresh. A leitura
vira uma comparação só — `expires_at IS NULL OR expires_at > now()` — em vez de
dois caminhos de código.

`ai_run.feature_id` é nulo de propósito. A extração de carteira recomendada
gasta dinheiro e não é uma feature registrada; sem o campo nulo ela não
apareceria na tela de custo. O registro acontece na fronteira do provider, de
modo que nada chega a um modelo sem deixar linha aqui.
"""

from alembic import op

revision = 'e1a3c5b7d9f2'
down_revision = 'd6f8a0b2c4e7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto;')
    op.execute('CREATE SCHEMA IF NOT EXISTS ai;')

    op.execute("""
        CREATE TABLE ai.ai_feature (
            id BIGSERIAL PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            output_schema_version INTEGER NOT NULL DEFAULT 1,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            freshness TEXT NOT NULL DEFAULT 'time',
            ttl_hours INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT ck_ai_feature_freshness CHECK (freshness IN ('time', 'manual')),
            CONSTRAINT ck_ai_feature_ttl CHECK (
                (freshness = 'time' AND ttl_hours IS NOT NULL AND ttl_hours > 0)
                OR (freshness = 'manual' AND ttl_hours IS NULL)
            )
        );
    """)

    op.execute("""
        CREATE TABLE ai.ai_prompt_version (
            id BIGSERIAL PRIMARY KEY,
            feature_id BIGINT NOT NULL REFERENCES ai.ai_feature(id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            system TEXT NOT NULL DEFAULT '',
            template TEXT NOT NULL,
            model TEXT NOT NULL,
            temperature DOUBLE PRECISION NOT NULL DEFAULT 0.2,
            max_output_tokens INTEGER,
            web_search BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT FALSE,
            notes TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_ai_prompt_version_number UNIQUE (feature_id, version)
        );
    """)
    op.execute("""
        CREATE UNIQUE INDEX uq_ai_prompt_version_active
            ON ai.ai_prompt_version (feature_id) WHERE is_active;
    """)

    op.execute("""
        CREATE TABLE ai.ai_artifact (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            feature_id BIGINT NOT NULL REFERENCES ai.ai_feature(id) ON DELETE CASCADE,
            prompt_version_id BIGINT NOT NULL
                REFERENCES ai.ai_prompt_version(id) ON DELETE CASCADE,
            input_hash TEXT NOT NULL,
            input JSONB NOT NULL,
            payload JSONB NOT NULL,
            schema_version INTEGER NOT NULL DEFAULT 1,
            model TEXT NOT NULL DEFAULT '',
            generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ,
            CONSTRAINT uq_ai_artifact_identity
                UNIQUE (feature_id, prompt_version_id, input_hash)
        );
    """)

    op.execute("""
        CREATE TABLE ai.ai_run (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            feature_id BIGINT REFERENCES ai.ai_feature(id) ON DELETE SET NULL,
            prompt_version_id BIGINT REFERENCES ai.ai_prompt_version(id) ON DELETE SET NULL,
            label TEXT NOT NULL,
            provider TEXT NOT NULL DEFAULT '',
            model TEXT NOT NULL DEFAULT '',
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0,
            cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
            latency_ms INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            error TEXT,
            trace_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)
    op.execute('CREATE INDEX ix_ai_run_created_at ON ai.ai_run (created_at DESC);')
    op.execute("""
        CREATE INDEX ix_ai_run_feature ON ai.ai_run (feature_id, created_at DESC);
    """)

    _seed_asset_description()


def _seed_asset_description() -> None:
    """A primeira feature e o prompt com que ela nasce.

    A validade é manual: o que um ativo é não muda porque passou uma semana, e
    regenerar por relógio pagaria de novo pelo mesmo parágrafo. Quem quiser uma
    leitura nova pede refresh — e a data de geração no card existe justamente
    para essa decisão.
    """
    op.execute("""
        INSERT INTO ai.ai_feature (key, name, description, freshness, ttl_hours)
        VALUES (
            'asset_description',
            'Descrição do ativo',
            'O que o ativo é e como performou, descrito e não julgado. '
            'Os números vêm da aplicação; o modelo escreve a prosa em volta deles.',
            'manual',
            NULL
        );
    """)
    op.execute("""
        INSERT INTO ai.ai_prompt_version (
            feature_id, version, system, template, model,
            temperature, max_output_tokens, web_search, is_active, notes
        )
        SELECT
            f.id, 1,
            'Você descreve instrumentos financeiros para um investidor pessoa física '
            || 'brasileiro. Escreve em português do Brasil, de forma direta e factual.'
            || E'\n\n'
            || 'Regras que não se negociam:' || E'\n'
            || '1. NÃO recomende, não avalie se está caro ou barato, não diga se vale a '
            || 'pena comprar, manter ou vender, e não projete preço. Você descreve.' || E'\n'
            || '2. Os números de desempenho vêm prontos na seção DESEMPENHO. Use apenas '
            || 'esses. Não calcule, não estime e não traga número de outra fonte. Um '
            || 'campo marcado como "não medido" deve ser dito como não disponível, '
            || 'nunca preenchido.' || E'\n'
            || '3. Os dados da seção CADASTRO são a verdade da aplicação. Se algo que '
            || 'você encontrar na web divergir deles, prevalece o cadastro.' || E'\n'
            || '4. Todo fato que vier da web precisa da URL de onde veio. Não invente '
            || 'link, título nem data.',
            'Descreva o ativo abaixo.' || E'\n\n'
            || 'IDENTIFICAÇÃO' || E'\n'
            || '- Código: {ticker}' || E'\n'
            || '- Nome: {name}' || E'\n'
            || '- Tipo: {asset_type}' || E'\n'
            || '- Bolsa: {exchange}' || E'\n\n'
            || 'CADASTRO' || E'\n'
            || '{registry_facts}' || E'\n\n'
            || 'DESEMPENHO (medido pela aplicação sobre as cotações persistidas)' || E'\n'
            || '{performance}' || E'\n\n'
            || 'Hoje é {today}. Pesquise na web o que o emissor ou o fundo faz, os fatos '
            || 'cadastrais que faltam acima e o que houve de relevante nos últimos meses.'
            || E'\n\n'
            || 'Preencha:' || E'\n'
            || '- what_it_is: o que este instrumento é, para quem nunca ouviu falar dele.'
            || E'\n'
            || '- what_it_does: a atividade, o mandato ou o segmento em que atua.' || E'\n'
            || '- how_it_performed: os números de DESEMPENHO em prosa, dizendo o período '
            || 'a que se referem. Nenhum número novo.' || E'\n'
            || '- key_facts: fatos cadastrais objetivos, com a fonte quando vierem da web.'
            || E'\n'
            || '- recent_developments: o que aconteceu de relevante, descrito sem juízo, '
            || 'com link e data.' || E'\n'
            || '- sources: as páginas que você usou.',
            'gpt-4o', 0.2, 4000, TRUE, TRUE,
            'Versão inicial. Descritiva por construção: o schema não tem campo de '
            'recomendação, então não há onde uma caber.'
        FROM ai.ai_feature f
        WHERE f.key = 'asset_description';
    """)


def downgrade() -> None:
    op.execute('DROP TABLE IF EXISTS ai.ai_run;')
    op.execute('DROP TABLE IF EXISTS ai.ai_artifact;')
    op.execute('DROP TABLE IF EXISTS ai.ai_prompt_version;')
    op.execute('DROP TABLE IF EXISTS ai.ai_feature;')
    op.execute('DROP SCHEMA IF EXISTS ai;')
