from dataclasses import is_dataclass
from datetime import date, datetime, timezone

from sqlalchemy import UniqueConstraint, inspect

from app.infra.db.base import Base
from app.infra.db.mappings import start_mappers
from app.infra.db.tables.ingestion import (
    data_ingestion_attempt_table,
    data_ingestion_execution_table,
)
from app.infra.db.tables.market_data_series import (
    market_data_series_history_table,
    market_data_series_table,
)
from app.infra.db.tables.quote import quote_table
from app.infra.db.tables.usd_brl import usd_brl_history_table
from app.modules.market_data.api.ingestion.schemas import (
    DataIngestionExecutionDetailResponse,
)
from app.modules.market_data.domain.ingestion import (
    DataIngestionAttempt,
    DataIngestionExecution,
    DataIngestionType,
)
from app.modules.market_data.domain.market_data_series import (
    MarketDataSeries,
    MarketDataSeriesHistory,
)
from app.modules.market_data.domain.quote import Quote
from app.modules.market_data.domain.usd_brl import UsdBrlHistory

start_mappers()


def test_quote_has_market_data_columns_and_unique_key():
    columns = quote_table.columns
    assert {
        'asset_id',
        'currency_id',
        'date',
        'open',
        'close',
        'adjusted_close',
        'high',
        'low',
        'volume',
        'source',
        'updated_at',
    }.issubset(columns.keys())
    constraints = {
        constraint.name: tuple(column.name for column in constraint.columns)
        for constraint in quote_table.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    assert constraints['uq_quote_asset_date'] == ('asset_id', 'date')


def test_market_data_series_uses_two_explicit_tables():
    assert set(market_data_series_table.columns.keys()) == {
        'id',
        'symbol',
        'short_name',
        'name',
        'series_type',
        'value_type',
        'frequency',
        'currency_id',
    }
    assert set(market_data_series_history_table.columns.keys()) == {
        'id',
        'series_id',
        'date',
        'open',
        'close',
        'high',
        'low',
        'source',
    }
    constraints = {
        constraint.name: tuple(column.name for column in constraint.columns)
        for constraint in market_data_series_history_table.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    assert constraints['uq_market_data_series_history_date'] == ('series_id', 'date')


def test_usd_brl_history_is_a_separate_table():
    assert set(usd_brl_history_table.columns.keys()) == {
        'id',
        'date',
        'usd_to_brl_rate',
        'source',
        'updated_at',
    }
    assert usd_brl_history_table.name != market_data_series_history_table.name


def test_data_ingestion_tables_are_generic_and_typed():
    assert {
        'ingestion_type',
        'total_items',
        'processed_items',
        'succeeded_items',
        'failed_items',
    }.issubset(data_ingestion_execution_table.columns.keys())
    assert {'item_id', 'item_label'}.issubset(data_ingestion_attempt_table.columns.keys())
    assert 'asset_id' not in data_ingestion_attempt_table.columns


def test_market_data_entities_use_imperative_mapping():
    entities_and_tables = (
        (MarketDataSeries, market_data_series_table),
        (MarketDataSeriesHistory, market_data_series_history_table),
        (UsdBrlHistory, usd_brl_history_table),
        (Quote, quote_table),
        (DataIngestionExecution, data_ingestion_execution_table),
        (DataIngestionAttempt, data_ingestion_attempt_table),
    )
    for entity, table in entities_and_tables:
        assert is_dataclass(entity)
        assert inspect(entity).local_table is table
        assert Base not in entity.__mro__


def test_ingestion_mapping_preserves_relationship_and_api_serialization():
    now = datetime.now(timezone.utc)
    execution = DataIngestionExecution(
        id=1,
        ingestion_type=DataIngestionType.MARKET_DATA_SERIES.value,
        trigger='manual',
        status='success',
        requested_at=now,
    )
    attempt = DataIngestionAttempt(
        id=2,
        execution_id=1,
        item_id=6,
        item_label='IBOVESPA',
        source='provider',
        status='success',
        attempted_at=now,
    )
    execution.attempts.append(attempt)

    response = DataIngestionExecutionDetailResponse.model_validate(execution)

    assert attempt.execution is execution
    assert response.ingestion_type == 'market_data_series'
    assert response.attempts[0].item_label == 'IBOVESPA'


def test_series_history_relationship_is_preserved():
    series = MarketDataSeries(
        id=6,
        symbol='^BVSP',
        short_name='IBOVESPA',
        name='Índice Bovespa',
        series_type='market_index',
        value_type='level',
        frequency='daily',
    )
    history = MarketDataSeriesHistory(
        series_id=6,
        date=date(2026, 8, 8),
        close=100_000,
    )
    history.series = series
    assert history.series is series


def test_cross_module_references_remain_opaque_ids():
    assert 'asset' not in inspect(Quote).relationships
    assert 'currency' not in inspect(Quote).relationships
    assert set(inspect(DataIngestionExecution).relationships.keys()) == {'attempts'}
    assert set(inspect(DataIngestionAttempt).relationships.keys()) == {'execution'}
