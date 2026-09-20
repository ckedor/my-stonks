"""Legal entities, asset registry fields, and the FII/ETF registry link.

Registers the legal entity behind an asset (the issuing company of a stock, the
administrator of a fund), the cadastral fields the asset itself was missing, and
the link from a FII or a Brazilian ETF to the regulator's registry entry that is
already ingested.

The link points at the fund, not at one of its classes: the CNPJ a provider
returns for a FII is the fund's, and it resolves 539 of 539 funds against 448
by class. Administrator, manager, status and dates live on the fund too.

The administrator becomes a foreign key because a fund declares exactly one.
The manager stays text: 1,040 funds declare more than one and 218 declare a
natural person, so it does not fit a legal-entity key.

Revision ID: c7e9a1b3d5f8
Revises: b4d6f8a0c2e3
"""

import sqlalchemy as sa
from alembic import op

revision = 'c7e9a1b3d5f8'
down_revision = 'b4d6f8a0c2e3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'institution',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('cnpj', sa.String(14), nullable=False, unique=True),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('legal_name', sa.String(300), nullable=False),
        sa.Column('cvm_code', sa.String(10), nullable=True, unique=True),
        sa.Column('country', sa.String(2), nullable=False, server_default='BR'),
        sa.Column('status', sa.String(40), nullable=True),
        sa.Column('registered_at', sa.Date(), nullable=True),
        sa.Column(
            'refreshed_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema='asset',
    )

    op.add_column(
        'asset',
        sa.Column(
            'institution_id',
            sa.Integer(),
            sa.ForeignKey('asset.institution.id'),
            nullable=True,
        ),
        schema='asset',
    )
    op.add_column(
        'asset',
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        schema='asset',
    )
    op.add_column('asset', sa.Column('summary', sa.String(300), nullable=True), schema='asset')
    op.add_column('asset', sa.Column('description', sa.Text(), nullable=True), schema='asset')

    op.add_column('stock', sa.Column('share_class', sa.String(10), nullable=True), schema='asset')
    op.add_column(
        'stock', sa.Column('listing_segment', sa.String(60), nullable=True), schema='asset'
    )

    for table in ('fii', 'etf'):
        op.add_column(
            table,
            sa.Column(
                'fund_registry_id',
                sa.Integer(),
                sa.ForeignKey('asset.fund_registry.id'),
                nullable=True,
            ),
            schema='asset',
        )
        # Um fundo do registro é um ativo só. A coluna é nula para o que não
        # está no registro, e o Postgres não compara nulos nesta restrição.
        op.create_unique_constraint(
            f'uq_{table}_fund_registry',
            table,
            ['fund_registry_id'],
            schema='asset',
        )

    op.add_column(
        'fund_registry',
        sa.Column(
            'administrator_institution_id',
            sa.Integer(),
            sa.ForeignKey('asset.institution.id'),
            nullable=True,
        ),
        schema='asset',
    )
    op.create_index(
        'ix_fund_registry_administrator_institution_id',
        'fund_registry',
        ['administrator_institution_id'],
        schema='asset',
    )

    _migrate_administrators()


def _migrate_administrators() -> None:
    """Turn each distinct administrator CNPJ already in the registry into a row.

    Nothing is dropped: ``administrator_name`` and ``administrator_cnpj`` stay
    where they are, so a fund whose CNPJ is malformed keeps the text it had and
    simply has no link.
    """
    op.execute("""
        INSERT INTO asset.institution (cnpj, name, legal_name)
        SELECT DISTINCT ON (administrator_cnpj)
               administrator_cnpj,
               COALESCE(NULLIF(TRIM(administrator_name), ''), administrator_cnpj),
               COALESCE(NULLIF(TRIM(administrator_name), ''), administrator_cnpj)
          FROM asset.fund_registry
         WHERE administrator_cnpj IS NOT NULL
           AND length(administrator_cnpj) = 14
         ORDER BY administrator_cnpj, refreshed_at DESC NULLS LAST
        ON CONFLICT (cnpj) DO NOTHING
    """)
    op.execute("""
        UPDATE asset.fund_registry AS fr
           SET administrator_institution_id = i.id
          FROM asset.institution AS i
         WHERE i.cnpj = fr.administrator_cnpj
    """)


def downgrade() -> None:
    op.drop_index(
        'ix_fund_registry_administrator_institution_id', 'fund_registry', schema='asset'
    )
    op.drop_column('fund_registry', 'administrator_institution_id', schema='asset')

    for table in ('fii', 'etf'):
        op.drop_constraint(f'uq_{table}_fund_registry', table, schema='asset')
        op.drop_column(table, 'fund_registry_id', schema='asset')

    op.drop_column('stock', 'listing_segment', schema='asset')
    op.drop_column('stock', 'share_class', schema='asset')

    op.drop_column('asset', 'description', schema='asset')
    op.drop_column('asset', 'summary', schema='asset')
    op.drop_column('asset', 'status', schema='asset')
    op.drop_column('asset', 'institution_id', schema='asset')

    op.drop_table('institution', schema='asset')
