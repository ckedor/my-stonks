from celery import Celery

from app.config.settings import settings

from .scheduler import beat_schedule

celery_app = Celery("my-stonks")

celery_app.conf.broker_url = settings.REDIS_URL
celery_app.conf.result_backend = settings.REDIS_URL
celery_app.conf.timezone = "America/Sao_Paulo"
celery_app.conf.enable_utc = False
celery_app.conf.imports = (
    'app.modules.market_data.tasks.ingest_market_data_series',
    'app.modules.market_data.tasks.ingest_quotes',
    'app.modules.market_data.tasks.ingest_usd_brl',
    'app.modules.market_data.tasks.maintain_data_ingestion_history',
    'app.modules.portfolio.tasks.consolidate_all_portfolios',
    'app.modules.portfolio.tasks.consolidate_fiis_dividends',
    'app.modules.portfolio.tasks.consolidate_portfolio_returns',
    'app.modules.portfolio.tasks.consolidate_single_portfolio',
    'app.modules.portfolio.tasks.ingest_quotes_for_held_assets',
    'app.modules.portfolio.tasks.recalculate_asset_position',
)

celery_app.conf.beat_schedule = beat_schedule
