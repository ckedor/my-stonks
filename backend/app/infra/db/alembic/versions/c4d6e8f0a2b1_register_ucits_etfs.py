"""register the UCITS ETFs CSPX and VWRA

Revision ID: c4d6e8f0a2b1
Revises: d8b2f4a6c0e1
Create Date: 2026-09-20 11:42:00.000000

Two Irish-domiciled UCITS ETFs listed in London, registered here rather than
through the admin screen because they are wanted in production and a seeded
row is what survives a rebuild.

The ticker carries the `.L` suffix, and that is not cosmetic: the market-data
provider answers `/v2/stocks/historical?symbols=CSPX.L` with the full daily
series in USD, and `CSPX` alone comes back `NOT_FOUND`. The suffix is the
identifier the provider knows, so it is the identifier the asset is stored
under — the quote ingestion sends `asset.ticker` to the provider untouched.

London joins `asset.exchange` for the same reason the rest of it exists: the
exchange is what decides Brazilian or foreign for the portfolio segment and
for the tax report, and the fallback that reads the shape of the ticker is a
rescue for the rows that never recorded one, not a place to add to.

Both funds are accumulating, so nothing here has to account for distributions.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c4d6e8f0a2b1'
down_revision: Union[str, None] = 'd8b2f4a6c0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

#: Ticker as the provider knows it, and the name it publishes for it.
#: `asset_type_id` is the ETF id from the seeded catalogue, by id and never by
#: `short_name`: that column holds pt-BR product copy.
ETF_ASSET_TYPE_ID = 1

UCITS_ETFS = (
    ('CSPX.L', 'iShares Core S&P 500 UCITS ETF USD (Acc)'),
    ('VWRA.L', 'Vanguard FTSE All-World UCITS ETF USD Accumulation'),
)

TICKERS = tuple(ticker for ticker, _ in UCITS_ETFS)


def upgrade() -> None:
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

    Quotes and page visits are market data and come back from the provider, so
    they go with the asset. A transaction, a position, a dividend, a category
    assignment or a line of a theoretical or recommended portfolio is somebody's
    own record: an asset carrying one stays, and so does the exchange, because
    undoing the registration would take that record with it.
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

            DELETE FROM asset.exchange e
            WHERE e.code = 'LSE'
              AND NOT EXISTS (SELECT 1 FROM asset.asset a WHERE a.exchange_id = e.id);
        END $$;
    """)
