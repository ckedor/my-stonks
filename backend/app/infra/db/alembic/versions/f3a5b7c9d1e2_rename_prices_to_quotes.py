"""rename structured price data to quotes

Revision ID: f3a5b7c9d1e2
Revises: d2f4a6b8c0e1
Create Date: 2026-08-04 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = 'f3a5b7c9d1e2'
down_revision: Union[str, None] = 'd2f4a6b8c0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _rename_constraints(old_prefix: str, new_prefix: str, table_name: str) -> None:
    op.execute(
        f"""
        DO $$
        DECLARE item record;
        BEGIN
            FOR item IN
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'market_data.{table_name}'::regclass
                  AND conname LIKE '{old_prefix}%'
            LOOP
                EXECUTE format(
                    'ALTER TABLE market_data.{table_name} RENAME CONSTRAINT %I TO %I',
                    item.conname,
                    replace(item.conname, '{old_prefix}', '{new_prefix}')
                );
            END LOOP;
        END $$;
        """
    )


def _rename_indexes(old_prefix: str, new_prefix: str) -> None:
    op.execute(
        f"""
        DO $$
        DECLARE item record;
        BEGIN
            FOR item IN
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = 'market_data'
                  AND indexname LIKE '{old_prefix}%'
            LOOP
                EXECUTE format(
                    'ALTER INDEX market_data.%I RENAME TO %I',
                    item.indexname,
                    replace(item.indexname, '{old_prefix}', '{new_prefix}')
                );
            END LOOP;
        END $$;
        """
    )


def _rename_sequences(old_prefix: str, new_prefix: str) -> None:
    op.execute(
        f"""
        DO $$
        DECLARE item record;
        BEGIN
            FOR item IN
                SELECT sequencename
                FROM pg_sequences
                WHERE schemaname = 'market_data'
                  AND sequencename LIKE '{old_prefix}%'
            LOOP
                EXECUTE format(
                    'ALTER SEQUENCE market_data.%I RENAME TO %I',
                    item.sequencename,
                    replace(item.sequencename, '{old_prefix}', '{new_prefix}')
                );
            END LOOP;
        END $$;
        """
    )


def upgrade() -> None:
    op.rename_table('asset_price_history', 'quote', schema='market_data')
    op.rename_table(
        'price_consolidation_execution',
        'quote_consolidation_execution',
        schema='market_data',
    )
    op.rename_table(
        'price_consolidation_attempt',
        'quote_consolidation_attempt',
        schema='market_data',
    )

    op.execute(
        'ALTER TABLE market_data.quote '
        'RENAME CONSTRAINT uq_asset_date TO uq_quote_asset_date'
    )
    _rename_constraints('asset_price_history', 'quote', 'quote')
    _rename_constraints(
        'fk_asset_price_history',
        'fk_quote',
        'quote',
    )
    _rename_constraints(
        'price_consolidation_execution',
        'quote_consolidation_execution',
        'quote_consolidation_execution',
    )
    _rename_constraints(
        'price_consolidation_attempt',
        'quote_consolidation_attempt',
        'quote_consolidation_attempt',
    )

    _rename_indexes('ix_market_data_price_consolidation', 'ix_market_data_quote_consolidation')
    _rename_sequences('asset_price_history', 'quote')
    _rename_sequences('price_consolidation_execution', 'quote_consolidation_execution')
    _rename_sequences('price_consolidation_attempt', 'quote_consolidation_attempt')

    op.execute(
        'ALTER FUNCTION market_data.set_asset_price_history_updated_at() '
        'RENAME TO set_quote_updated_at'
    )
    op.execute(
        'ALTER TRIGGER trg_asset_price_history_set_updated_at '
        'ON market_data.quote RENAME TO trg_quote_set_updated_at'
    )


def downgrade() -> None:
    op.execute(
        'ALTER TRIGGER trg_quote_set_updated_at '
        'ON market_data.quote RENAME TO trg_asset_price_history_set_updated_at'
    )
    op.execute(
        'ALTER FUNCTION market_data.set_quote_updated_at() '
        'RENAME TO set_asset_price_history_updated_at'
    )

    _rename_indexes('ix_market_data_quote_consolidation', 'ix_market_data_price_consolidation')
    _rename_sequences('quote_consolidation_attempt', 'price_consolidation_attempt')
    _rename_sequences('quote_consolidation_execution', 'price_consolidation_execution')
    _rename_sequences('quote', 'asset_price_history')

    op.execute(
        'ALTER TABLE market_data.quote '
        'RENAME CONSTRAINT uq_quote_asset_date TO uq_asset_date'
    )
    _rename_constraints('quote', 'asset_price_history', 'quote')
    _rename_constraints(
        'fk_quote',
        'fk_asset_price_history',
        'quote',
    )
    _rename_constraints(
        'quote_consolidation_execution',
        'price_consolidation_execution',
        'quote_consolidation_execution',
    )
    _rename_constraints(
        'quote_consolidation_attempt',
        'price_consolidation_attempt',
        'quote_consolidation_attempt',
    )

    op.rename_table(
        'quote_consolidation_attempt',
        'price_consolidation_attempt',
        schema='market_data',
    )
    op.rename_table(
        'quote_consolidation_execution',
        'price_consolidation_execution',
        schema='market_data',
    )
    op.rename_table('quote', 'asset_price_history', schema='market_data')
