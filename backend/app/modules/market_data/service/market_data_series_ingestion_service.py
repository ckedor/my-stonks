import asyncio
from collections.abc import Callable
from datetime import date, timedelta

from app.config.logger import logger
from app.core.exceptions import NotFoundError
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.market_data.domain.market_data_series import (
    MarketDataSeries,
    MarketDataSeriesHistory,
)
from app.modules.market_data.repositories.market_data_repository import (
    SERIES_HISTORY_UPSERT_COLUMNS,
)
from app.modules.market_data.service.data_ingestion_service import DataIngestionService

SERIES_HISTORY_OVERLAP_DAYS = 7
MAX_CONCURRENT_SERIES_REQUESTS = 5


class MarketDataSeriesIngestionService:
    def __init__(
        self,
        *,
        uow_factory: Callable[[], UnitOfWork],
        ingestion_service: DataIngestionService,
        provider: MarketDataProvider,
    ):
        self.uow_factory = uow_factory
        self.ingestion_service = ingestion_service
        self.provider = provider

    async def run(
        self,
        *,
        execution_id: int | None = None,
        force_full_history: bool = False,
    ) -> int | None:
        prepared = await self.ingestion_service.prepare_execution(
            ingestion_type=DataIngestionType.MARKET_DATA_SERIES,
            execution_id=execution_id,
            force_full_history=force_full_history,
        )
        if prepared is None:
            return execution_id
        current_execution_id, force_full_history, requested_ids = prepared
        try:
            async with self.uow_factory() as uow:
                available = await uow.market_data.get_all(MarketDataSeries)
                series_by_id = {series.id: series for series in available}
                item_ids = requested_ids or list(series_by_id)
                missing = [item_id for item_id in item_ids if item_id not in series_by_id]
                if missing:
                    raise NotFoundError(
                        'Market data series not found',
                        context={'missing_ids': missing},
                    )
                latest_dates = await uow.market_data.get_latest_series_dates(item_ids)

            await self.ingestion_service.set_execution_items(
                current_execution_id,
                item_ids=item_ids,
                parameters={
                    'force_full_history': force_full_history,
                    'item_ids': item_ids,
                },
            )
            semaphore = asyncio.Semaphore(MAX_CONCURRENT_SERIES_REQUESTS)
            await asyncio.gather(*[
                self._ingest_one(
                    current_execution_id,
                    series_by_id[item_id],
                    latest_date=latest_dates.get(item_id),
                    force_full_history=force_full_history,
                    semaphore=semaphore,
                )
                for item_id in item_ids
            ])
            await self.ingestion_service.finish(current_execution_id)
            return current_execution_id
        except Exception as exc:
            logger.exception('Market data series ingestion failed')
            await self.ingestion_service.fail(current_execution_id, exc)
            raise

    async def _ingest_one(
        self,
        execution_id: int,
        series: MarketDataSeries,
        *,
        latest_date: date | None,
        force_full_history: bool,
        semaphore: asyncio.Semaphore,
    ) -> None:
        start_date = (
            None
            if force_full_history
            else (latest_date or date.today()) - timedelta(days=SERIES_HISTORY_OVERLAP_DAYS)
        )
        parameters = {
            'series_id': series.id,
            'symbol': series.symbol,
            'start_date': start_date.isoformat() if start_date else None,
            'force_full_history': force_full_history,
        }
        source = self.provider.get_series_source(series)
        attempt_id = await self.ingestion_service.start_attempt(
            execution_id,
            item_id=series.id,
            item_label=series.short_name,
            source=source,
            parameters=parameters,
        )
        try:
            async with semaphore:
                # A series that waited its turn may have been queued behind an
                # abort. Its attempt is already closed by the abort itself, so
                # this only has to stop the work.
                if await self.ingestion_service.is_aborted(execution_id):
                    return
                history_df = await self.provider.get_series_historical_data(
                    series,
                    init_date=start_date,
                )
            history_df = history_df.copy()
            if start_date is not None and not history_df.empty:
                history_dates = history_df['date'].map(
                    lambda value: value.date() if hasattr(value, 'date') else value
                )
                history_df = history_df[history_dates >= start_date]
            history_df['series_id'] = series.id
            history_df['source'] = source
            columns = [
                column for column in SERIES_HISTORY_UPSERT_COLUMNS if column in history_df.columns
            ]
            rows = history_df[columns].to_dict(orient='records')
            if rows:
                async with self.uow_factory() as uow:
                    await uow.market_data.upsert_bulk(
                        MarketDataSeriesHistory,
                        rows,
                        unique_columns=['series_id', 'date'],
                    )
                    await uow.commit()
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='success',
                parameters=parameters,
                fetched_rows=len(rows),
                upserted_rows=len(rows),
            )
        except Exception as exc:
            await self.ingestion_service.finish_attempt(
                execution_id,
                attempt_id,
                status='failure',
                parameters=parameters,
                error=str(exc) or exc.__class__.__name__,
            )

    async def aclose(self) -> None:
        await self.provider.close()
