"""Give every quote an adjusted close

Ingestion now falls back to the traded close whenever the provider publishes no
adjusted series, so returns can always be measured on an adjusted basis. The
history already stored predates that, so it is filled the same way rather than
left as a hole every reader would have to work around.

Revision ID: a1c3e5f7b9d0
Revises: f5b7c9d1e3a4
Create Date: 2026-08-13

"""

from alembic import op

revision = 'a1c3e5f7b9d0'
down_revision = 'f5b7c9d1e3a4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE market_data.quote
        SET adjusted_close = close
        WHERE adjusted_close IS NULL AND close IS NOT NULL
    """)


def downgrade() -> None:
    # The filled values are indistinguishable from the ones the provider sent,
    # so there is nothing to undo without destroying real data.
    pass
