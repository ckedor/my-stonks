from collections.abc import Callable
from datetime import date, timedelta
from decimal import Decimal

from app.config.logger import logger
from app.core.exceptions import ValidationError
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.ingestion import DataIngestionType
from app.modules.market_data.domain.usd_brl import UsdBrlHistory, invert_rate
from app.modules.market_data.service.data_ingestion_service import DataIngestionService
from app.modules.market_data.service.market_data_service import INDEXES_HISTORY_CACHE_PREFIX
from app.modules.market_data.service.usd_brl_service import USD_BRL_HISTORY_CACHE_PREFIX

USD_BRL_DATASET_ID = 1
USD_BRL_OVERLAP_DAYS = 7


class UsdBrlIngestionService:
    def __init__(
        self,
        *,
        uow_factory: Callable[[], UnitOfWork],
        ingestion_service: DataIngestionService,
        provider: MarketDataProvider,
        cache: RedisService,
    ):
        self.uow_factory = uow_factory
        self.ingestion_service = ingestion_service
        self.provider = provider
        self.cache = cache

    async def _invalidate_rate_caches(self) -> None:
        """Drop the reads a fresh rate makes stale, after the write has landed.

        Nothing repopulates them here: the next read misses and fills. The index
        history is included because it embeds the rate twice over -- as a series
        charted alongside the indexes, and as the factor converting the
        USD-denominated ones into BRL.
        """
        await self.cache.delete_prefix(f'{USD_BRL_HISTORY_CACHE_PREFIX}:')
        await self.cache.delete_prefix(f'{INDEXES_HISTORY_CACHE_PREFIX}:')

    async def run(
        self,
        *,
        execution_id: int | None = None,
        force_full_history: bool = False,
    ) -> int | None:
        prepared = await self.ingestion_service.prepare_execution(
            ingestion_type=DataIngestionType.USD_BRL,
            execution_id=execution_id,
            force_full_history=force_full_history,
            scheduled_item_ids=[USD_BRL_DATASET_ID],
        )
        if prepared is None:
            return execution_id
        current_execution_id, force_full_history, item_ids = prepared
        attempt_id: int | None = None
        attempt_finished = False
        parameters: dict = {}
        try:
            item_ids = item_ids or [USD_BRL_DATASET_ID]
            if item_ids != [USD_BRL_DATASET_ID]:
                raise ValidationError('USD/BRL ingestion accepts only item ID 1')
            async with self.uow_factory() as uow:
                latest_date = await uow.market_data.get_latest_usd_brl_date()
            start_date = (
                None
                if force_full_history
                else (latest_date or date.today()) - timedelta(days=USD_BRL_OVERLAP_DAYS)
            )
            parameters = {
                'item_ids': item_ids,
                'start_date': start_date.isoformat() if start_date else None,
                'force_full_history': force_full_history,
            }
            await self.ingestion_service.set_execution_items(
                current_execution_id,
                item_ids=item_ids,
                parameters=parameters,
            )
            attempt_id = await self.ingestion_service.start_attempt(
                current_execution_id,
                item_id=USD_BRL_DATASET_ID,
                item_label='USD/BRL',
                source='bcb',
                parameters=parameters,
            )
            history_df = await self.provider.get_usd_brl_historical_data(
                init_date=start_date,
            )
            if start_date is not None and not history_df.empty:
                history_dates = history_df['date'].map(
                    lambda value: value.date() if hasattr(value, 'date') else value
                )
                history_df = history_df[history_dates >= start_date]
            # Both directions are assembled here so that no consumer of the
            # table ever has to invert the rate itself.
            rows = []
            for row in history_df.to_dict(orient='records'):
                usd_brl = Decimal(str(row['usd_brl']))
                if usd_brl <= 0:
                    logger.warning('Ignoring non-positive USD/BRL rate on %s', row['date'])
                    continue
                rows.append({
                    'date': row['date'],
                    'usd_brl': usd_brl,
                    'brl_usd': invert_rate(usd_brl),
                    'source': 'bcb',
                })
            async with self.uow_factory() as uow:
                await uow.market_data.upsert_bulk(
                    UsdBrlHistory,
                    rows,
                    unique_columns=['date'],
                )
                await uow.commit()
            await self._invalidate_rate_caches()
            await self.ingestion_service.finish_attempt(
                current_execution_id,
                attempt_id,
                status='success',
                parameters=parameters,
                fetched_rows=len(rows),
                upserted_rows=len(rows),
            )
            attempt_finished = True
            await self.ingestion_service.finish(current_execution_id)
            return current_execution_id
        except Exception as exc:
            logger.exception('USD/BRL ingestion failed')
            if attempt_id is not None and not attempt_finished:
                await self.ingestion_service.finish_attempt(
                    current_execution_id,
                    attempt_id,
                    status='failure',
                    parameters=parameters,
                    error=str(exc) or exc.__class__.__name__,
                )
            await self.ingestion_service.fail(current_execution_id, exc)
            raise

    async def aclose(self) -> None:
        await self.provider.close()
