"""Unify the three return tables into one, and stamp consolidation

Revision ID: a1c3e5f7b9d2
Revises: f5a7b9c1d3e4
Create Date: 2026-08-29

portfolio_return, category_return and asset_type_return held the same columns
over different groupings, so they become one table discriminated by scope. The
existing rows are carried over: nothing is recomputed here, and the segment
series -- which never existed -- are written by the next consolidation.
"""

import sqlalchemy as sa
from alembic import op

revision = 'a1c3e5f7b9d2'
down_revision = 'f5a7b9c1d3e4'
branch_labels = None
depends_on = None

RETURN_COLUMNS = 'daily_return, acc_return, cagr, daily_return_usd, acc_return_usd, cagr_usd'


def upgrade() -> None:
    op.create_table(
        'return_series',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'portfolio_id',
            sa.Integer(),
            sa.ForeignKey('portfolio.portfolio.id'),
            nullable=False,
        ),
        sa.Column('scope', sa.String(), nullable=False),
        sa.Column('scope_key', sa.String(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('daily_return', sa.Float(), nullable=False),
        sa.Column('acc_return', sa.Float(), nullable=False),
        sa.Column('cagr', sa.Float(), nullable=True),
        sa.Column('daily_return_usd', sa.Float(), nullable=True),
        sa.Column('acc_return_usd', sa.Float(), nullable=True),
        sa.Column('cagr_usd', sa.Float(), nullable=True),
        sa.UniqueConstraint(
            'portfolio_id',
            'scope',
            'scope_key',
            'date',
            name='uq_return_series_portfolio_scope_date',
        ),
        schema='portfolio',
    )
    op.create_index(
        'ix_return_series_lookup',
        'return_series',
        ['portfolio_id', 'scope', 'scope_key', 'date'],
        schema='portfolio',
    )

    # A carteira inteira usa string vazia, e não NULL: o Postgres trata NULLs
    # como distintos, e a constraint aceitaria o mesmo dia duas vezes.
    op.execute(f"""
        INSERT INTO portfolio.return_series
            (portfolio_id, scope, scope_key, date, {RETURN_COLUMNS})
        SELECT portfolio_id, 'portfolio', '', date, {RETURN_COLUMNS}
        FROM portfolio.portfolio_return
    """)
    op.execute(f"""
        INSERT INTO portfolio.return_series
            (portfolio_id, scope, scope_key, date, {RETURN_COLUMNS})
        SELECT portfolio_id, 'category', custom_category_id::text, date, {RETURN_COLUMNS}
        FROM portfolio.category_return
    """)
    op.execute(f"""
        INSERT INTO portfolio.return_series
            (portfolio_id, scope, scope_key, date, {RETURN_COLUMNS})
        SELECT portfolio_id, 'asset_type', asset_type_id::text, date, {RETURN_COLUMNS}
        FROM portfolio.asset_type_return
    """)

    op.drop_table('asset_type_return', schema='portfolio')
    op.drop_table('category_return', schema='portfolio')
    op.drop_table('portfolio_return', schema='portfolio')

    op.create_table(
        'portfolio_consolidation',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'portfolio_id',
            sa.Integer(),
            sa.ForeignKey('portfolio.portfolio.id'),
            nullable=False,
            unique=True,
        ),
        sa.Column('consolidated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        schema='portfolio',
    )


def downgrade() -> None:
    op.drop_table('portfolio_consolidation', schema='portfolio')

    for name, key_column, key_type, scope in (
        ('portfolio_return', None, None, 'portfolio'),
        ('category_return', 'custom_category_id', 'portfolio.custom_category.id', 'category'),
        ('asset_type_return', 'asset_type_id', 'asset.asset_type.id', 'asset_type'),
    ):
        columns = [
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column(
                'portfolio_id',
                sa.Integer(),
                sa.ForeignKey('portfolio.portfolio.id'),
                nullable=False,
            ),
        ]
        if key_column:
            columns.append(
                sa.Column(
                    key_column,
                    sa.Integer(),
                    sa.ForeignKey(key_type),
                    nullable=False,
                )
            )
        columns.extend([
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('daily_return', sa.Float(), nullable=False),
            sa.Column('acc_return', sa.Float(), nullable=False),
            sa.Column('cagr', sa.Float(), nullable=True),
            sa.Column('daily_return_usd', sa.Float(), nullable=True),
            sa.Column('acc_return_usd', sa.Float(), nullable=True),
            sa.Column('cagr_usd', sa.Float(), nullable=True),
        ])
        op.create_table(name, *columns, schema='portfolio')

        target = f'portfolio_id, {key_column}, date' if key_column else 'portfolio_id, date'
        source = 'portfolio_id, scope_key::integer, date' if key_column else 'portfolio_id, date'
        op.execute(f"""
            INSERT INTO portfolio.{name} ({target}, {RETURN_COLUMNS})
            SELECT {source}, {RETURN_COLUMNS}
            FROM portfolio.return_series
            WHERE scope = '{scope}'
        """)

    op.drop_index('ix_return_series_lookup', 'return_series', schema='portfolio')
    op.drop_table('return_series', schema='portfolio')
