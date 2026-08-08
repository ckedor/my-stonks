import asyncio
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config.logger import logger
from app.core.exceptions import NotFoundError, ValidationError
from app.modules.market_data.domain.constants import CURRENCY_MAP
from app.infra.db.unit_of_work import UnitOfWork
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.quote import (
    AssetQuoteIngestionResult,
    AssetSnapshot,
    FetchedQuotes,
    Quote,
    QuoteIngestionResult,
)
from app.modules.market_data.domain.ingestion import (
    DataIngestionAttempt,
    DataIngestionExecution,
)
from app.modules.market_data.repositories.asset_repository import AssetRepository
from app.modules.market_data.repositories.quote_repository import QuoteRepository

ASSET_CACHE_TTL_SECONDS = 600
QUOTE_HISTORY_OVERLAP_DAYS = 7
MAX_CONCURRENT_PROVIDER_REQUESTS = 5
MARKET_TIMEZONE = ZoneInfo('America/Sao_Paulo')


@dataclass
class _AssetFetchOutcome:
    asset: AssetSnapshot
    attempt_id: int | None
    parameters: dict
    fetched: FetchedQuotes | None = None
    error: Exception | None = None


class PersistedQuoteReadService:
    """Read registered assets and their persisted quote history only."""

    def __init__(
        self,
        *,
        asset_repository: AssetRepository,
        quote_repository: QuoteRepository,
    ) -> None:
        self.asset_repository = asset_repository
        self.quote_repository = quote_repository

    async def get_quotes(
        self,
        *,
        asset_ids: Sequence[int] | None = None,
        tickers: Sequence[str] | None = None,
        asset_type_id: int | None = None,
        start_date: date | None = None,
    ) -> list[dict]:
        ids = list(dict.fromkeys(int(value) for value in (asset_ids or [])))
        symbols = list(
            dict.fromkeys(value.strip().upper() for value in (tickers or []) if value.strip())
        )
        if bool(ids) == bool(symbols):
            raise ValidationError('Provide either asset_ids or tickers')
        if symbols and asset_type_id is None:
            raise ValidationError('asset_type_id is required when using tickers')

        if ids:
            assets = await self.asset_repository.get_by_ids(ids)
            assets_by_key = {asset.id: asset for asset in assets}
            ordered_assets = [assets_by_key[value] for value in ids if value in assets_by_key]
            missing = [value for value in ids if value not in assets_by_key]
        else:
            assets = await self.asset_repository.get_by_tickers(symbols, int(asset_type_id))
            assets_by_key = {asset.ticker.upper(): asset for asset in assets}
            ordered_assets = [assets_by_key[value] for value in symbols if value in assets_by_key]
            missing = [value for value in symbols if value not in assets_by_key]

        if missing:
            raise NotFoundError('Some assets were not found', context={'missing': missing})

        rows = await self.quote_repository.get_quotes(
            [asset.id for asset in ordered_assets],
            start_date=start_date,
        )
        quotes_by_asset: dict[int, list[dict]] = {asset.id: [] for asset in ordered_assets}
        for row in rows:
            quotes_by_asset[row.asset_id].append(self._quote_to_dict(row))
        return [
            {
                'asset_id': asset.id,
                'ticker': asset.ticker,
                'asset_type_id': asset.asset_type_id,
                'quotes': quotes_by_asset[asset.id],
            }
            for asset in ordered_assets
        ]

    @staticmethod
    def _quote_to_dict(quote: Quote) -> dict:
        return {
            'date': quote.date,
            'open': float(quote.open) if quote.open is not None else None,
            'high': float(quote.high) if quote.high is not None else None,
            'low': float(quote.low) if quote.low is not None else None,
            'close': float(quote.close) if quote.close is not None else None,
            'adjusted_close': (
                float(quote.adjusted_close) if quote.adjusted_close is not None else None
            ),
            'volume': float(quote.volume) if quote.volume is not None else None,
            'currency_id': quote.currency_id,
            'source': quote.source,
        }


class OnDemandQuoteReadService:
    """Read provider quotes without accessing or mutating application storage."""

    def __init__(self, provider: MarketDataProvider) -> None:
        self.provider = provider

    async def get_quotes(
        self,
        *,
        ticker: str,
        asset_type_id: int,
        start_date: date | None = None,
        exchange: str | None = None,
    ) -> dict:
        fetched = await self.provider.fetch_quotes(
            ticker=ticker,
            asset_type_id=asset_type_id,
            start_date=start_date,
            exchange=exchange,
        )
        return {
            'ticker': fetched.ticker,
            'asset_type_id': asset_type_id,
            'currency': fetched.currency,
            'quotes': [PersistedQuoteReadService._quote_to_dict(item) for item in fetched.quotes],
        }

    async def aclose(self) -> None:
        await self.provider.close()


class QuoteService:
    def __init__(
        self,
        *,
        uow_factory: Callable[[], UnitOfWork],
        provider: MarketDataProvider,
        cache: RedisService,
        max_concurrent_requests: int = MAX_CONCURRENT_PROVIDER_REQUESTS,
        today: Callable[[], date] | None = None,
    ):
        self.uow_factory = uow_factory
        self.provider = provider
        self.cache = cache
        self.max_concurrent_requests = max(1, max_concurrent_requests)
        self.today = today or self._market_today

    def _provider(self) -> MarketDataProvider:
        return self.provider

    async def ingest_quotes(
        self,
        *,
        asset_ids: Sequence[int] | None = None,
        tickers: Sequence[str] | None = None,
        asset_type_id: int | None = None,
        force_full_history: bool = False,
        execution_id: int | None = None,
    ) -> QuoteIngestionResult:
        """Fetch and upsert daily history for registered assets.

        Full mode requests the maximum available history. Incremental runs
        request only a seven-day window when local history is empty, or overlap
        the latest persisted date by seven days when history already exists.
        """
        results: list[AssetQuoteIngestionResult] = []
        pending_fetches = []
        async with self.uow_factory() as uow:
            asset_repo = uow.assets
            quote_repo = uow.quotes
            ingestion_repo = uow.ingestions if execution_id is not None else None
            assets, missing = await self._resolve_assets(
                asset_repo=asset_repo,
                asset_ids=asset_ids,
                tickers=tickers,
                asset_type_id=asset_type_id,
            )
            latest_dates = await quote_repo.get_latest_quote_dates([asset.id for asset in assets])

            for missing_item in missing:
                result = AssetQuoteIngestionResult(
                    asset_id=missing_item.get('asset_id', 0),
                    ticker=missing_item.get('ticker', 'unknown'),
                    status='failure',
                    source='asset_repository',
                    error='Asset not found',
                )
                await self._record_lookup_failure(
                    ingestion_repo,
                    execution_id,
                    missing_item,
                    result,
                )
                results.append(result)

            for asset in assets:
                start_date = self._get_start_date(
                    latest_date=latest_dates.get(asset.id),
                    force_full_history=force_full_history,
                )
                parameters = self._build_attempt_parameters(
                    asset,
                    start_date=start_date,
                    force_full_history=force_full_history,
                )
                attempt_id = await self._start_attempt(
                    ingestion_repo,
                    execution_id=execution_id,
                    asset=asset,
                    parameters=parameters,
                )
                pending_fetches.append((asset, start_date, attempt_id, parameters))

        semaphore = asyncio.Semaphore(self.max_concurrent_requests)
        tasks = [
            asyncio.create_task(
                self._fetch_quotes(
                    asset,
                    start_date=start_date,
                    attempt_id=attempt_id,
                    parameters=parameters,
                    semaphore=semaphore,
                )
            )
            for asset, start_date, attempt_id, parameters in pending_fetches
        ]
        for completed in asyncio.as_completed(tasks):
            outcome = await completed
            results.append(
                await self._persist_asset_fetch(
                    outcome,
                    execution_id=execution_id,
                )
            )

        return QuoteIngestionResult(assets=results)

    async def aclose(self) -> None:
        if self.provider is not None:
            await self.provider.close()

    async def _fetch_quotes(
        self,
        asset: AssetSnapshot,
        *,
        start_date: date | None,
        attempt_id: int | None,
        parameters: dict,
        semaphore: asyncio.Semaphore,
    ) -> _AssetFetchOutcome:
        try:
            async with semaphore:
                fetched = await self._provider().fetch_quotes(
                    ticker=asset.ticker,
                    asset_type_id=asset.asset_type_id,
                    start_date=start_date,
                    exchange=asset.exchange,
                )
            parameters = {
                **parameters,
                'provider_parameters': fetched.parameters,
            }
            if not fetched.quotes:
                raise NotFoundError('No quotes returned by provider')

            return _AssetFetchOutcome(
                asset=asset,
                attempt_id=attempt_id,
                parameters=parameters,
                fetched=fetched,
            )
        except Exception as exc:
            return _AssetFetchOutcome(
                asset=asset,
                attempt_id=attempt_id,
                parameters=parameters,
                error=exc,
            )

    async def _persist_asset_fetch(
        self,
        outcome: _AssetFetchOutcome,
        *,
        execution_id: int | None,
    ) -> AssetQuoteIngestionResult:
        asset = outcome.asset
        fetched = outcome.fetched
        if outcome.error is not None or fetched is None:
            error_value = outcome.error or RuntimeError('Provider returned no result')
            error = str(error_value) or error_value.__class__.__name__
            logger.warning('Quote ingestion failed for %s: %s', asset.ticker, error)
            async with self.uow_factory() as uow:
                await self._finish_attempt(
                    getattr(uow, 'ingestions', None),
                    outcome.attempt_id,
                    execution_id=execution_id,
                    status='failure',
                    parameters=outcome.parameters,
                    error=error,
                )
            return AssetQuoteIngestionResult(
                asset_id=asset.id,
                ticker=asset.ticker,
                status='failure',
                source=self._provider().quote_source,
                error=error,
            )

        try:
            currency_id = CURRENCY_MAP.get(fetched.currency)
            rows = [
                {
                    'asset_id': asset.id,
                    'currency_id': int(currency_id) if currency_id else None,
                    'date': point.date,
                    'open': point.open,
                    'close': point.close,
                    'adjusted_close': point.adjusted_close,
                    'high': point.high,
                    'low': point.low,
                    'volume': point.volume,
                    'source': fetched.source,
                }
                for point in fetched.quotes
            ]
            async with self.uow_factory() as uow:
                quote_repo = uow.quotes
                await quote_repo.upsert_quotes(rows)
                await self._finish_attempt(
                    getattr(uow, 'ingestions', None),
                    outcome.attempt_id,
                    execution_id=execution_id,
                    status='success',
                    parameters=outcome.parameters,
                    fetched_rows=len(rows),
                    upserted_rows=len(rows),
                )
            return AssetQuoteIngestionResult(
                asset_id=asset.id,
                ticker=asset.ticker,
                status='success',
                source=fetched.source,
                fetched_rows=len(rows),
                upserted_rows=len(rows),
            )
        except Exception as exc:
            error = str(exc) or exc.__class__.__name__
            logger.warning('Quote ingestion failed for %s: %s', asset.ticker, error)
            async with self.uow_factory() as uow:
                await self._finish_attempt(
                    getattr(uow, 'ingestions', None),
                    outcome.attempt_id,
                    execution_id=execution_id,
                    status='failure',
                    parameters=outcome.parameters,
                    error=error,
                )
            return AssetQuoteIngestionResult(
                asset_id=asset.id,
                ticker=asset.ticker,
                status='failure',
                source=fetched.source,
                error=error,
            )

    def _get_start_date(
        self,
        *,
        latest_date: date | None,
        force_full_history: bool,
    ) -> date | None:
        if force_full_history:
            return None
        reference_date = latest_date or self.today()
        return reference_date - timedelta(days=QUOTE_HISTORY_OVERLAP_DAYS)

    def _build_attempt_parameters(
        self,
        asset: AssetSnapshot,
        *,
        start_date: date | None,
        force_full_history: bool,
    ) -> dict:
        return {
            'ticker': asset.ticker,
            'asset_type_id': asset.asset_type_id,
            'exchange': asset.exchange,
            'start_date': start_date.isoformat() if start_date else None,
            'end_date': self.today().isoformat(),
            'force_full_history': force_full_history,
        }

    @staticmethod
    def _market_today() -> date:
        return datetime.now(MARKET_TIMEZONE).date()

    async def _resolve_assets(
        self,
        *,
        asset_repo: AssetRepository,
        asset_ids: Sequence[int] | None,
        tickers: Sequence[str] | None,
        asset_type_id: int | None,
    ) -> tuple[list[AssetSnapshot], list[dict]]:
        ids = list(dict.fromkeys(int(value) for value in (asset_ids or [])))
        symbols = list(
            dict.fromkeys(value.strip().upper() for value in (tickers or []) if value.strip())
        )
        if bool(ids) == bool(symbols):
            raise ValidationError('Provide either asset_ids or tickers')
        if symbols and asset_type_id is None:
            raise ValidationError('asset_type_id is required when using tickers')

        assets: list[AssetSnapshot] = []
        missing_keys: list[int | str] = []
        lookup_values: Sequence[int | str] = ids or symbols
        for value in lookup_values:
            cached = await self._get_cached_asset(value, asset_type_id=asset_type_id)
            if cached is None:
                missing_keys.append(value)
            else:
                assets.append(cached)

        if missing_keys:
            if ids:
                db_assets = await asset_repo.get_by_ids([int(value) for value in missing_keys])
            else:
                db_assets = await asset_repo.get_by_tickers(
                    [str(value) for value in missing_keys],
                    int(asset_type_id),
                )
            snapshots = [self._snapshot(asset) for asset in db_assets if asset.ticker]
            assets.extend(snapshots)
            for snapshot in snapshots:
                await self._cache_asset(snapshot)

        assets_by_id = {asset.id: asset for asset in assets}
        if ids:
            ordered = [assets_by_id[value] for value in ids if value in assets_by_id]
            missing = [
                {'asset_id': value, 'ticker': f'asset:{value}'}
                for value in ids
                if value not in assets_by_id
            ]
            return ordered, missing

        assets_by_ticker = {asset.ticker.upper(): asset for asset in assets}
        ordered = [assets_by_ticker[value] for value in symbols if value in assets_by_ticker]
        missing = [
            {'asset_id': 0, 'ticker': value, 'asset_type_id': asset_type_id}
            for value in symbols
            if value not in assets_by_ticker
        ]
        return ordered, missing

    async def _get_cached_asset(
        self,
        value: int | str,
        *,
        asset_type_id: int | None,
    ) -> AssetSnapshot | None:
        key = (
            f'market_data:asset:id:{value}'
            if isinstance(value, int)
            else f'market_data:asset:ticker:{asset_type_id}:{value}'
        )
        try:
            data = await self.cache.get_json(key)
            return AssetSnapshot.from_dict(data) if data else None
        except Exception as exc:
            logger.warning('Asset cache read failed: %s', exc)
            return None

    async def _cache_asset(self, asset: AssetSnapshot) -> None:
        keys = [
            f'market_data:asset:id:{asset.id}',
            f'market_data:asset:ticker:{asset.asset_type_id}:{asset.ticker.upper()}',
        ]
        for key in keys:
            try:
                await self.cache.set_json(
                    key,
                    asset.to_dict(),
                    expire_seconds=ASSET_CACHE_TTL_SECONDS,
                )
            except Exception as exc:
                logger.warning('Asset cache write failed: %s', exc)

    @staticmethod
    def _snapshot(asset) -> AssetSnapshot:
        return AssetSnapshot(
            id=asset.id,
            ticker=asset.ticker,
            asset_type_id=asset.asset_type_id,
            exchange=asset.exchange.code if asset.exchange else None,
        )

    async def _start_attempt(
        self,
        ingestion_repo,
        *,
        execution_id: int | None,
        asset: AssetSnapshot,
        parameters: dict,
    ) -> int | None:
        if execution_id is None:
            return None
        attempt = await ingestion_repo.create_attempt(
            execution_id=execution_id,
            item_id=asset.id,
            item_label=asset.ticker,
            source=self._provider().quote_source,
            parameters=parameters,
        )
        return attempt.id

    async def _finish_attempt(  # noqa: PLR0913
        self,
        ingestion_repo,
        attempt_id: int | None,
        *,
        execution_id: int | None,
        status: str,
        parameters: dict,
        fetched_rows: int = 0,
        upserted_rows: int = 0,
        error: str | None = None,
    ) -> None:
        if attempt_id is None:
            return
        attempt = await ingestion_repo.get(
            DataIngestionAttempt,
            id=attempt_id,
        )
        attempt.status = status
        attempt.parameters = parameters
        attempt.finished_at = datetime.now(timezone.utc)
        attempt.fetched_rows = fetched_rows
        attempt.upserted_rows = upserted_rows
        attempt.error = error
        await self._increment_execution(
            ingestion_repo,
            execution_id,
            status=status,
            fetched_rows=fetched_rows,
            upserted_rows=upserted_rows,
        )

    async def _record_lookup_failure(
        self,
        ingestion_repo,
        execution_id: int | None,
        missing_item: dict,
        result: AssetQuoteIngestionResult,
    ) -> None:
        if execution_id is None:
            return
        attempt = await ingestion_repo.create_attempt(
            execution_id=execution_id,
            item_id=None,
            item_label=result.ticker,
            source=result.source,
            parameters=missing_item,
        )
        attempt.status = 'failure'
        attempt.finished_at = datetime.now(timezone.utc)
        attempt.error = result.error
        await self._increment_execution(
            ingestion_repo,
            execution_id,
            status='failure',
        )

    @staticmethod
    async def _increment_execution(
        ingestion_repo,
        execution_id: int | None,
        *,
        status: str,
        fetched_rows: int = 0,
        upserted_rows: int = 0,
    ) -> None:
        if execution_id is None:
            return
        execution = await ingestion_repo.get(
            DataIngestionExecution,
            id=execution_id,
        )
        execution.processed_items += 1
        execution.fetched_rows += fetched_rows
        execution.upserted_rows += upserted_rows
        if status == 'success':
            execution.succeeded_items += 1
        else:
            execution.failed_items += 1
