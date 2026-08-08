"""rename quote consolidation monitoring to ingestion

Revision ID: a4b6c8d0e2f3
Revises: f3a5b7c9d1e2
Create Date: 2026-08-04 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = 'a4b6c8d0e2f3'
down_revision: Union[str, None] = 'f3a5b7c9d1e2'
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
    op.rename_table(
        'quote_consolidation_execution',
        'quote_ingestion_execution',
        schema='market_data',
    )
    op.rename_table(
        'quote_consolidation_attempt',
        'quote_ingestion_attempt',
        schema='market_data',
    )

    _rename_constraints(
        'quote_consolidation_execution',
        'quote_ingestion_execution',
        'quote_ingestion_execution',
    )
    _rename_constraints(
        'quote_consolidation_attempt',
        'quote_ingestion_attempt',
        'quote_ingestion_attempt',
    )
    _rename_indexes('ix_market_data_quote_consolidation', 'ix_market_data_quote_ingestion')
    _rename_sequences('quote_consolidation_execution', 'quote_ingestion_execution')
    _rename_sequences('quote_consolidation_attempt', 'quote_ingestion_attempt')


def downgrade() -> None:
    _rename_indexes('ix_market_data_quote_ingestion', 'ix_market_data_quote_consolidation')
    _rename_sequences('quote_ingestion_execution', 'quote_consolidation_execution')
    _rename_sequences('quote_ingestion_attempt', 'quote_consolidation_attempt')
    _rename_constraints(
        'quote_ingestion_execution',
        'quote_consolidation_execution',
        'quote_ingestion_execution',
    )
    _rename_constraints(
        'quote_ingestion_attempt',
        'quote_consolidation_attempt',
        'quote_ingestion_attempt',
    )

    op.rename_table(
        'quote_ingestion_attempt',
        'quote_consolidation_attempt',
        schema='market_data',
    )
    op.rename_table(
        'quote_ingestion_execution',
        'quote_consolidation_execution',
        schema='market_data',
    )
