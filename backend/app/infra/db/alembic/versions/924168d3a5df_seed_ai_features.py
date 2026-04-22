"""seed ai features

Revision ID: 924168d3a5df
Revises: ad824dbafcbc
Create Date: 2026-04-21 19:03:54.005871

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '924168d3a5df'
down_revision: Union[str, None] = 'ad824dbafcbc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        INSERT INTO ai.ai_feature (key, default_ttl_hours)
        VALUES
            ('ASSET_OVERVIEW_AND_NEWS', 168)
        ON CONFLICT (key) DO NOTHING;
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        DELETE FROM ai.ai_feature
        WHERE key IN (
            'ASSET_OVERVIEW_AND_NEWS'
        );
        """
    )
