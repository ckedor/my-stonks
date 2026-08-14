"""add LCA to asset_type

Revision ID: 2ce91a1f52d2
Revises: 66da198fcf6d
Create Date: 2025-09-17 12:38:52.425416

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '2ce91a1f52d2'
down_revision: Union[str, None] = '66da198fcf6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            INSERT INTO asset.asset_type (id, short_name, name, asset_class_id) VALUES
                (14, 'LCA', 'Letra de Crédito do Agronegócio', 1)
            ON CONFLICT DO NOTHING
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            DELETE FROM asset.asset_type
            WHERE id = 14
            """
        )
    )
