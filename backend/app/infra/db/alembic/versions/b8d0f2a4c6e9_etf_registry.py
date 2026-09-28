"""ETF registry: foreign ETFs as the regulators register them

Revision ID: b8d0f2a4c6e9
Revises: c3e5a7b9d1f4
Create Date: 2026-09-25 18:00:00.000000

A foreign ETF gets the same treatment the Brazilian fund registry already has:
the regulator's whole list lands in reference tables weekly, and an asset
points at the registered class it is a listing of.

Three changes make room for it.

`asset.institution` stops requiring a CNPJ. The manager of an American or Irish
ETF — BlackRock Fund Advisors, BlackRock Asset Management Ireland — has none;
what identifies it is the LEI, which is also what every source here names it
by. A legal entity must still carry at least one of the two, so a row nothing
can match again cannot be written.

`asset.asset` gains the ISIN. It identifies the share class, not the listing:
CSPX on London and SXR8 on Xetra carry the same `IE00B5BMR087`, which is why it
is not unique. It is what ties a London listing to its class — no source maps
a London ticker to an ISIN since London left FIRDS — and the four set below are
the four London listings registered by `c4d6e8f0a2b1` and `e6f8a0b2c4d3`, each
checked against FIRDS on 2026-09-25.

`asset.etf` gains the link to the registered class, next to the link to the
Brazilian fund registry. An ETF is one or the other, never both.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b8d0f2a4c6e9'
down_revision: Union[str, None] = 'c3e5a7b9d1f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

#: Ticker as registered, and the ISIN FIRDS states for the class it lists.
LONDON_LISTINGS = (
    ('CSPX.L', 'IE00B5BMR087'),
    ('VWRA.L', 'IE00BK5BQT80'),
    ('EIMI.L', 'IE00BKM4GZ66'),
    ('EXUS.L', 'IE0006WW1TQ4'),
)

ISIN_PATTERN = "'^[A-Z]{2}[A-Z0-9]{9}[0-9]$'"
LEI_PATTERN = "'^[A-Z0-9]{18}[0-9]{2}$'"


def upgrade() -> None:
    op.alter_column('institution', 'cnpj', nullable=True, schema='asset')
    op.add_column('institution', sa.Column('lei', sa.String(20), nullable=True), schema='asset')
    op.create_unique_constraint('uq_institution_lei', 'institution', ['lei'], schema='asset')
    op.create_check_constraint(
        'ck_institution_identified',
        'institution',
        'cnpj IS NOT NULL OR lei IS NOT NULL',
        schema='asset',
    )
    op.create_check_constraint(
        'ck_institution_lei_format', 'institution', f'lei ~ {LEI_PATTERN}', schema='asset'
    )

    op.add_column('asset', sa.Column('isin', sa.String(12), nullable=True), schema='asset')
    op.create_index('ix_asset_isin', 'asset', ['isin'], schema='asset')
    op.create_check_constraint(
        'ck_asset_isin_format', 'asset', f'isin ~ {ISIN_PATTERN}', schema='asset'
    )

    op.create_table(
        'etf_registry',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('lei', sa.String(20), nullable=True, unique=True),
        sa.Column('source', sa.String(10), nullable=False),
        sa.Column('sec_series_id', sa.String(10), nullable=True, unique=True),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('domicile', sa.String(2), nullable=False),
        sa.Column(
            'umbrella_institution_id',
            sa.Integer(),
            sa.ForeignKey('asset.institution.id'),
            nullable=True,
            index=True,
        ),
        sa.Column('tracks_index', sa.Boolean(), nullable=True),
        sa.Column('leveraged_or_inverse', sa.Boolean(), nullable=True),
        sa.Column('fund_of_funds', sa.Boolean(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column(
            'refreshed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("source IN ('sec', 'esma')", name='ck_etf_registry_source'),
        sa.CheckConstraint(
            "(source = 'sec' AND sec_series_id IS NOT NULL) OR (source = 'esma' AND lei IS NOT NULL)",
            name='ck_etf_registry_identified',
        ),
        sa.CheckConstraint("status IN ('active', 'inactive')", name='ck_etf_registry_status'),
        sa.CheckConstraint(f'lei ~ {LEI_PATTERN}', name='ck_etf_registry_lei_format'),
        schema='asset',
    )

    op.create_table(
        'etf_registry_manager',
        sa.Column(
            'etf_registry_id',
            sa.Integer(),
            sa.ForeignKey('asset.etf_registry.id', ondelete='CASCADE'),
            primary_key=True,
        ),
        sa.Column(
            'institution_id',
            sa.Integer(),
            sa.ForeignKey('asset.institution.id'),
            primary_key=True,
            index=True,
        ),
        schema='asset',
    )

    op.create_table(
        'etf_registry_class',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'etf_registry_id',
            sa.Integer(),
            sa.ForeignKey('asset.etf_registry.id'),
            nullable=False,
            index=True,
        ),
        sa.Column('sec_class_id', sa.String(10), nullable=True, unique=True),
        sa.Column('isin', sa.String(12), nullable=True, unique=True),
        sa.Column('ticker', sa.String(20), nullable=True, index=True),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('currency', sa.String(3), nullable=True),
        sa.Column('distribution_policy', sa.String(20), nullable=True),
        sa.Column('cfi_code', sa.String(6), nullable=True),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column(
            'refreshed_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            'sec_class_id IS NOT NULL OR isin IS NOT NULL', name='ck_etf_registry_class_identified'
        ),
        sa.CheckConstraint(
            "distribution_policy IN ('accumulating', 'distributing', 'mixed')",
            name='ck_etf_registry_class_distribution_policy',
        ),
        sa.CheckConstraint(
            "status IN ('active', 'inactive')", name='ck_etf_registry_class_status'
        ),
        sa.CheckConstraint(f'isin ~ {ISIN_PATTERN}', name='ck_etf_registry_class_isin_format'),
        schema='asset',
    )

    op.add_column(
        'etf',
        sa.Column(
            'etf_registry_class_id',
            sa.Integer(),
            sa.ForeignKey('asset.etf_registry_class.id'),
            nullable=True,
        ),
        schema='asset',
    )
    op.create_index('ix_etf_etf_registry_class_id', 'etf', ['etf_registry_class_id'], schema='asset')
    op.create_check_constraint(
        'ck_etf_one_registry',
        'etf',
        'num_nonnulls(fund_registry_id, etf_registry_class_id) <= 1',
        schema='asset',
    )

    set_isin = sa.text("""
        UPDATE asset.asset
        SET isin = :isin
        WHERE ticker = :ticker
          AND asset_type_id = 1
          AND exchange_id = (SELECT id FROM asset.exchange WHERE code = 'LSE')
    """)
    for ticker, isin in LONDON_LISTINGS:
        op.execute(set_isin.bindparams(ticker=ticker, isin=isin))


def downgrade() -> None:
    op.drop_constraint('ck_etf_one_registry', 'etf', schema='asset')
    op.drop_index('ix_etf_etf_registry_class_id', table_name='etf', schema='asset')
    op.drop_column('etf', 'etf_registry_class_id', schema='asset')
    op.drop_table('etf_registry_class', schema='asset')
    op.drop_table('etf_registry_manager', schema='asset')
    op.drop_table('etf_registry', schema='asset')

    op.drop_constraint('ck_asset_isin_format', 'asset', schema='asset')
    op.drop_index('ix_asset_isin', table_name='asset', schema='asset')
    op.drop_column('asset', 'isin', schema='asset')

    # Only the ETF registry writes an entity without a CNPJ, and every table
    # that pointed at one is gone above. An asset naming one as its issuer is
    # somebody's record, so the downgrade fails on it instead of dropping it.
    op.execute('DELETE FROM asset.institution WHERE cnpj IS NULL')
    op.drop_constraint('ck_institution_lei_format', 'institution', schema='asset')
    op.drop_constraint('ck_institution_identified', 'institution', schema='asset')
    op.drop_constraint('uq_institution_lei', 'institution', schema='asset')
    op.drop_column('institution', 'lei', schema='asset')
    op.alter_column('institution', 'cnpj', nullable=False, schema='asset')
