"""ajustando autoincrement da tabela brokers

Revision ID: bf813f49cdb5
Revises: ff4534ee2b55
Create Date: 2025-04-27 10:10:39.442783

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bf813f49cdb5'
down_revision: Union[str, None] = 'ff4534ee2b55'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
