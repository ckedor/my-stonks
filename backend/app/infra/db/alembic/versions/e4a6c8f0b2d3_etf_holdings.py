"""ETF holdings: what a registered ETF held, from its regulator filing

Revision ID: e4a6c8f0b2d3
Revises: d2f4a6c8e0b1
Create Date: 2026-09-26 12:00:00.000000

One report per fund and date, with its lines. An American ETF's comes from its
N-PORT filing with the SEC. The weight is stored as a ratio of net assets, as
every proportion in the domain is; N-PORT files it in percentage points.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e4a6c8f0b2d3'
down_revision: Union[str, None] = 'd2f4a6c8e0b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'etf_holding_report',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'etf_registry_id', sa.Integer(), sa.ForeignKey('asset.etf_registry.id'), nullable=False
        ),
        sa.Column('report_date', sa.Date(), nullable=False),
        sa.Column('source', sa.String(20), nullable=False),
        sa.Column('accession', sa.String(20), nullable=False),
        sa.Column('net_assets', sa.Numeric(24, 2), nullable=True),
        sa.Column('total_assets', sa.Numeric(24, 2), nullable=True),
        sa.Column('holdings_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column(
            'fetched_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint(
            'etf_registry_id', 'report_date', name='uq_etf_holding_report_fund_date'
        ),
        schema='asset',
    )
    op.create_table(
        'etf_holding',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'report_id',
            sa.Integer(),
            sa.ForeignKey('asset.etf_holding_report.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('title', sa.String(300), nullable=True),
        sa.Column('isin', sa.String(12), nullable=True, index=True),
        sa.Column('cusip', sa.String(9), nullable=True),
        sa.Column('lei', sa.String(20), nullable=True),
        sa.Column('ticker', sa.String(30), nullable=True),
        sa.Column('asset_category', sa.String(10), nullable=True),
        sa.Column('country', sa.String(3), nullable=True),
        sa.Column('currency', sa.String(3), nullable=True),
        sa.Column('balance', sa.Numeric(28, 8), nullable=True),
        sa.Column('units', sa.String(10), nullable=True),
        sa.Column('value_usd', sa.Numeric(24, 2), nullable=True),
        sa.Column('weight', sa.Numeric(18, 12), nullable=True),
        sa.Column(
            'asset_id', sa.Integer(), sa.ForeignKey('asset.asset.id'), nullable=True, index=True
        ),
        schema='asset',
    )
    op.create_index(
        'ix_etf_holding_report_weight', 'etf_holding', ['report_id', 'weight'], schema='asset'
    )


def downgrade() -> None:
    op.drop_table('etf_holding', schema='asset')
    op.drop_table('etf_holding_report', schema='asset')
