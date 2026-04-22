"""create ai_feature and ai_artifact

Revision ID: ad824dbafcbc
Revises: 1095106b5968
Create Date: 2026-04-21 18:32:46.173789

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ad824dbafcbc'
down_revision: Union[str, None] = '1095106b5968'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto;')
    op.execute('CREATE SCHEMA IF NOT EXISTS ai;')

    op.execute(
        """
        CREATE TABLE ai.ai_feature (
            id BIGSERIAL PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            default_ttl_hours INTEGER NOT NULL DEFAULT 168,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION ai.set_ai_feature_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )

    op.execute(
        """
        CREATE TRIGGER trg_ai_feature_set_updated_at
        BEFORE UPDATE ON ai.ai_feature
        FOR EACH ROW
        EXECUTE FUNCTION ai.set_ai_feature_updated_at();
        """
    )

    op.execute(
        """
        CREATE TABLE ai.ai_artifact (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            feature_id BIGINT NOT NULL REFERENCES ai.ai_feature(id) ON DELETE RESTRICT,
            summary TEXT NOT NULL,
            payload JSONB NOT NULL,
            input_hash TEXT NULL,
            model TEXT NULL,
            generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """
    )

    op.execute(
        'CREATE INDEX idx_ai_artifact_lookup '
        'ON ai.ai_artifact (feature_id, generated_at DESC);'
    )
    op.execute(
        'CREATE INDEX idx_ai_artifact_expires ON ai.ai_artifact (expires_at);'
    )
    op.execute(
        'CREATE UNIQUE INDEX uq_ai_artifact_dedupe '
        'ON ai.ai_artifact (feature_id, input_hash) '
        'WHERE input_hash IS NOT NULL;'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute('DROP INDEX IF EXISTS ai.uq_ai_artifact_dedupe;')
    op.execute('DROP INDEX IF EXISTS ai.idx_ai_artifact_expires;')
    op.execute('DROP INDEX IF EXISTS ai.idx_ai_artifact_lookup;')
    op.execute('DROP TABLE IF EXISTS ai.ai_artifact;')

    op.execute('DROP TRIGGER IF EXISTS trg_ai_feature_set_updated_at ON ai.ai_feature;')
    op.execute('DROP FUNCTION IF EXISTS ai.set_ai_feature_updated_at();')
    op.execute('DROP TABLE IF EXISTS ai.ai_feature;')
    op.execute('DROP SCHEMA IF EXISTS ai;')
