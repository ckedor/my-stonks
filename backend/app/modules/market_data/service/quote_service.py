import asyncio
import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.config.logger import logger
from app.core.exceptions import NotFoundError, ValidationError
from app.infra.redis.decorators import cached
from app.modules.market_data.domain.constants import CURRENCY_MAP
from app.infra.db.unit_of_work import UnitOfWork
from app.modules.market_data.repositories.asset_repository import AssetRepository
from app.infra.redis.redis_service import RedisService
from app.modules.market_data.adapters.market_data_provider import MarketDataProvider
from app.modules.market_data.domain.quote import (
    AssetQuoteIngestionResult,
    AssetSnapshot,
    FetchedQuotes,
    Quote,
    QuoteIngestionResult,
    convert_quotes_to_currency,
    historical_cagr,
)
from app.modules.market_data.service.usd_brl_service import UsdBrlReadService
from app.modules.market_data.domain.ingestion import (
    ABORTED_STATUS,
    DataIngestionAttempt,
    DataIngestionExecution,
)

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

    def __init__(self, uow: UnitOfWork) -> None:
        self.uow = uow

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

        async with self.uow as uow:
            if ids:
                assets = await uow.assets.get_by_ids(ids)
                assets_by_key = {asset.id: asset for asset in assets}
                ordered_assets = [assets_by_key[value] for value in ids if value in assets_by_key]
                missing = [value for value in ids if value not in assets_by_key]
            else:
                assets = await uow.assets.get_by_tickers(symbols, int(asset_type_id))
                assets_by_key = {asset.ticker.upper(): asset for asset in assets}
                ordered_assets = [
                    assets_by_key[value] for value in symbols if value in assets_by_key
                ]
                missing = [value for value in symbols if value not in assets_by_key]

            if missing:
                raise NotFoundError('Some assets were not found', context={'missing': missing})

            rows = await uow.quotes.get_quotes(
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
    def _number(value) -> float | None:
        """A finite float, or None. Providers use NaN to mean "no value"."""
        if value is None:
            return None
        number = float(value)
        return number if math.isfinite(number) else None

    @staticmethod
    def _quote_to_dict(quote: Quote) -> dict:
        # Every value here is JSON-native: these dicts are serialized straight
        # into responses and into the cache.
        return {
            'date': quote.date.isoformat(),
            'open': PersistedQuoteReadService._number(quote.open),
            'high': PersistedQuoteReadService._number(quote.high),
            'low': PersistedQuoteReadService._number(quote.low),
            'close': PersistedQuoteReadService._number(quote.close),
            'adjusted_close': PersistedQuoteReadService._number(quote.adjusted_close),
            'volume': PersistedQuoteReadService._number(quote.volume),
            'currency_id': quote.currency_id,
            'source': quote.source,
        }


#: How long a provider quote read stays reusable. Intraday screens refresh
#: often, and the upstream series barely moves within a couple of minutes.
ON_DEMAND_QUOTES_TTL_SECONDS = 120


class OnDemandQuoteReadService:
    """Read provider quotes without accessing or mutating application storage.

    Reads are cached briefly: the same ticker opened repeatedly hits the
    provider once, and the cache fills on miss rather than being warmed.
    """

    def __init__(self, provider: MarketDataProvider, cache: RedisService | None = None) -> None:
        self.provider = provider
        self.cache = cache or RedisService()

    @cached(
        key_prefix='on_demand_quotes',
        cache=lambda self: self.cache,
        ttl=ON_DEMAND_QUOTES_TTL_SECONDS,
    )
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
            'logo_url': fetched.logo_url,
            'quotes': [PersistedQuoteReadService._quote_to_dict(item) for item in fetched.quotes],
        }

    #: Artwork changes far more slowly than prices, so it is held for a day.
    ASSET_LOGO_TTL_SECONDS = 86400

    @cached(key_prefix='asset_logo', cache=lambda self: self.cache, ttl=ASSET_LOGO_TTL_SECONDS)
    async def get_logo(self, *, ticker: str, asset_type_id: int) -> dict:
        return {'logo_url': await self.provider.fetch_asset_logo(ticker, asset_type_id)}

    async def aclose(self) -> None:
        await self.provider.close()


class AssetQuoteHistoryService:
    """Quote history for one asset, preferring what we already store.

    Persisted history is free, complete for everything we ingest, and costs no
    provider quota, so it answers whenever it exists. The provider is asked only
    for assets that have never been ingested -- browsing the catalogue, mostly.
    """

    def __init__(
        self,
        *,
        persisted: PersistedQuoteReadService,
        on_demand: OnDemandQuoteReadService,
        usd_brl: UsdBrlReadService,
    ) -> None:
        self.persisted = persisted
        self.on_demand = on_demand
        self.usd_brl = usd_brl

    async def get_history(
        self,
        *,
        asset_id: int,
        start_date: date | None = None,
        currency: str = 'BRL',
    ) -> dict:
        entries = await self.persisted.get_quotes(asset_ids=[asset_id], start_date=start_date)
        entry = entries[0]
        ticker, asset_type_id = entry['ticker'], entry['asset_type_id']
        logo = await self.on_demand.get_logo(ticker=ticker, asset_type_id=asset_type_id)

        if entry['quotes']:
            quotes, resolved = await self._in_currency(entry['quotes'], currency, ticker=ticker)
            return {
                'ticker': ticker,
                'asset_type_id': asset_type_id,
                'currency': resolved,
                'logo_url': logo['logo_url'],
                'source': 'database',
                'quotes': quotes,
                'cagr': self._cagr(quotes),
            }

        fetched = await self.on_demand.get_quotes(
            ticker=ticker,
            asset_type_id=asset_type_id,
            start_date=start_date,
        )
        quotes, resolved = await self._in_currency(
            fetched['quotes'],
            currency,
            ticker=ticker,
            # The provider reports the currency once for the series rather than
            # per observation, so it is what the quotes fall back to.
            default_currency_id=CURRENCY_MAP.get(fetched['currency']),
        )
        return {
            **fetched,
            'currency': resolved,
            'quotes': quotes,
            'logo_url': logo['logo_url'],
            'source': 'provider',
            'cagr': self._cagr(quotes),
        }

    @staticmethod
    def _cagr(quotes: list[dict]) -> dict | None:
        """Growth over the served history, computed by the module's own domain.

        It is measured on the quotes as served -- same currency, same window --
        so the rate always describes the series the caller received.
        """
        result = historical_cagr(quotes)
        return result.to_dict() if result else None

    async def _in_currency(
        self,
        quotes: list[dict],
        currency: str,
        *,
        ticker: str,
        default_currency_id: int | None = None,
    ) -> tuple[list[dict], str | None]:
        """Quotes restated in ``currency``, and the currency they ended up in.

        Quotes already in the requested currency are returned untouched. When
        none of them says what currency it is in, there is nothing to convert
        from, so they are served as they are and the response reports no
        currency rather than claiming one.
        """
        target_currency_id = CURRENCY_MAP.get(currency.upper())
        if target_currency_id is None:
            raise ValidationError(f'Unsupported currency: {currency}')

        known = {
            quote['currency_id'] or default_currency_id
            for quote in quotes
            if quote.get('currency_id') or default_currency_id
        }
        if not known:
            logger.warning('Quotes for %s carry no currency; serving them unconverted', ticker)
            return quotes, None
        if known == {int(target_currency_id)}:
            return quotes, currency.upper()

        converted = convert_quotes_to_currency(
            quotes,
            await self.usd_brl.get_full_history(),
            target_currency_id=target_currency_id,
            default_currency_id=default_currency_id,
        )
        if len(converted) < len(quotes):
            logger.warning(
                'Dropped %d of %d quotes for %s with no exchange rate on their date',
                len(quotes) - len(converted),
                len(quotes),
                ticker,
            )
        return converted, currency.upper()

    async def aclose(self) -> None:
        await self.on_demand.aclose()


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
            await uow.commit()

        semaphore = asyncio.Semaphore(self.max_concurrent_requests)
        results.extend(
            await asyncio.gather(*[
                self._ingest_asset(
                    asset,
                    start_date=start_date,
                    attempt_id=attempt_id,
                    parameters=parameters,
                    semaphore=semaphore,
                    execution_id=execution_id,
                )
                for asset, start_date, attempt_id, parameters in pending_fetches
            ])
        )

        return QuoteIngestionResult(assets=results)

    async def _ingest_asset(  # noqa: PLR0913
        self,
        asset: AssetSnapshot,
        *,
        start_date: date | None,
        attempt_id: int | None,
        parameters: dict,
        semaphore: asyncio.Semaphore,
        execution_id: int | None,
    ) -> AssetQuoteIngestionResult:
        """Fetch one asset's quotes and persist them before freeing the slot.

        Holding the semaphore across both halves is the point: a fetched
        history stays alive only while its asset owns a slot, so peak memory is
        bounded by ``max_concurrent_requests`` assets rather than by the size of
        the run. Fetching everything up front and persisting afterwards kept
        every completed response in memory until the sequential writer reached
        it, which is what exhausted the worker on full-history ingestions.
        """
        async with semaphore:
            # Checked here rather than before the slot: an asset that waited its
            # turn may have been queued behind an abort. Its attempt is already
            # closed by the abort itself, so this only has to stop the work.
            if await self._execution_aborted(execution_id):
                return AssetQuoteIngestionResult(
                    asset_id=asset.id,
                    ticker=asset.ticker,
                    status=ABORTED_STATUS,
                    source=self.provider.quote_source,
                )
            outcome = await self._fetch_quotes(
                asset,
                start_date=start_date,
                attempt_id=attempt_id,
                parameters=parameters,
            )
            return await self._persist_asset_fetch(outcome, execution_id=execution_id)

    async def _execution_aborted(self, execution_id: int | None) -> bool:
        """Whether the execution this run reports to was stopped on purpose."""
        if execution_id is None:
            return False
        async with self.uow_factory() as uow:
            execution = await uow.ingestions.get_execution(execution_id)
        return execution is None or execution.status == ABORTED_STATUS

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
    ) -> _AssetFetchOutcome:
        try:
            fetched = await self.provider.fetch_quotes(
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
                    uow.ingestions,
                    outcome.attempt_id,
                    execution_id=execution_id,
                    status='failure',
                    parameters=outcome.parameters,
                    error=error,
                )
                await uow.commit()
            return AssetQuoteIngestionResult(
                asset_id=asset.id,
                ticker=asset.ticker,
                status='failure',
                source=self.provider.quote_source,
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
                    uow.ingestions,
                    outcome.attempt_id,
                    execution_id=execution_id,
                    status='success',
                    parameters=outcome.parameters,
                    fetched_rows=len(rows),
                    upserted_rows=len(rows),
                )
                await uow.commit()
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
                    uow.ingestions,
                    outcome.attempt_id,
                    execution_id=execution_id,
                    status='failure',
                    parameters=outcome.parameters,
                    error=error,
                )
                await uow.commit()
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
            source=self.provider.quote_source,
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
