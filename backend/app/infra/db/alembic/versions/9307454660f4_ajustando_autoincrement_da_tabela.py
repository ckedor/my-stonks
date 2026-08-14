"""ajustando autoincrement da tabela

Revision ID: 9307454660f4
Revises: aaaf7e631ca4
Create Date: 2025-04-18 17:18:31.506925

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9307454660f4'
down_revision: Union[str, None] = 'aaaf7e631ca4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        SELECT setval('portfolio.custom_category_id_seq', (
            SELECT MAX(id) FROM portfolio.custom_category
        ));
    """)
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
