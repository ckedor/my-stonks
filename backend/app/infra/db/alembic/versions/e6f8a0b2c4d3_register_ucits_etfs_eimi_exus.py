"""register the UCITS ETFs EIMI and EXUS

Revision ID: e6f8a0b2c4d3
Revises: c4d6e8f0a2b1
Create Date: 2026-09-20 16:05:00.000000

The other two of the same batch, emerging markets and world ex-US, on the same
terms as `c4d6e8f0a2b1`: ticker with the `.L` suffix the provider answers to,
London as the exchange, accumulating so no distribution to account for.

A second revision rather than two more lines in the first one, because the
first has already shipped. Alembic runs a revision once and records it: a row
added to a migration somebody's database has already stamped is a row that
never arrives there.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e6f8a0b2c4d3'
down_revision: Union[str, None] = 'c4d6e8f0a2b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

#: The ETF id from the seeded catalogue, by id and never by `short_name`:
#: that column holds pt-BR product copy.
ETF_ASSET_TYPE_ID = 1

UCITS_ETFS = (
    ('EIMI.L', 'iShares Core MSCI EM IMI UCITS ETF USD (Acc)'),
    ('EXUS.L', 'Xtrackers MSCI World ex USA UCITS ETF 1C USD'),
)

TICKERS = tuple(ticker for ticker, _ in UCITS_ETFS)


def upgrade() -> None:
    # London is already there from the previous revision. Inserted again
    # anyway, because the lookup below resolves a missing exchange to NULL
    # instead of failing, and an asset landing without its exchange is the
    # kind of wrong that only shows up much later, on the screen that splits
    # Brazil from abroad.
    op.execute("""
        INSERT INTO asset.exchange (code, name)
        VALUES ('LSE', 'London Stock Exchange')
        ON CONFLICT (code) DO NOTHING
    """)

    insert = sa.text("""
        INSERT INTO asset.asset (ticker, name, asset_type_id, exchange_id, status)
        SELECT
            :ticker,
            :name,
            :asset_type_id,
            (SELECT id FROM asset.exchange WHERE code = 'LSE'),
            'active'
        ON CONFLICT ON CONSTRAINT uq_asset_ticker_exchange_type DO NOTHING
    """)
    for ticker, name in UCITS_ETFS:
        op.execute(
            insert.bindparams(ticker=ticker, name=name, asset_type_id=ETF_ASSET_TYPE_ID)
        )


def downgrade() -> None:
    """Remove the two assets, unless something already points at them.

    Same rule as the previous revision: quotes and page visits are market data
    and come back from the provider, so they go with the asset; a record of
    somebody's own — a transaction, a position, a dividend, a category
    assignment, a line of a theoretical or recommended portfolio — keeps the
    asset here, because undoing the registration would take that record with
    it. London stays: the first two UCITS ETFs are still pointing at it.
    """
    tickers = ', '.join(f"'{ticker}'" for ticker in TICKERS)
    op.execute(f"""
        DO $$
        DECLARE removable integer[];
        BEGIN
            SELECT array_agg(a.id) INTO removable
            FROM asset.asset a
            WHERE a.ticker IN ({tickers})
              AND NOT EXISTS (SELECT 1 FROM portfolio.transaction t WHERE t.asset_id = a.id)
              AND NOT EXISTS (SELECT 1 FROM portfolio.position p WHERE p.asset_id = a.id)
              AND NOT EXISTS (SELECT 1 FROM portfolio.dividend d WHERE d.asset_id = a.id)
              AND NOT EXISTS (
                  SELECT 1 FROM portfolio.custom_category_assignment c WHERE c.asset_id = a.id
              )
              AND NOT EXISTS (SELECT 1 FROM lab.theoretical_position l WHERE l.asset_id = a.id)
              AND NOT EXISTS (SELECT 1 FROM research.recommended_position r WHERE r.asset_id = a.id);

            IF removable IS NULL THEN
                RETURN;
            END IF;

            DELETE FROM market_data.quote WHERE asset_id = ANY(removable);
            DELETE FROM market_data.asset_visit WHERE asset_id = ANY(removable);
            DELETE FROM asset.asset WHERE id = ANY(removable);
        END $$;
    """)
