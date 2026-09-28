from celery import Celery

from app.config.settings import settings

from .scheduler import WORKER_TIMEZONE, beat_schedule

celery_app = Celery('my-stonks')

celery_app.conf.broker_url = settings.REDIS_URL
celery_app.conf.result_backend = settings.REDIS_URL
celery_app.conf.timezone = WORKER_TIMEZONE
celery_app.conf.enable_utc = False
celery_app.conf.imports = (
    'app.modules.ai.tasks.run_ai_feature',
    'app.modules.market_data.tasks.ingest_etf_holdings',
    'app.modules.market_data.tasks.ingest_etf_registry',
    'app.modules.market_data.tasks.ingest_fund_registry',
    'app.modules.market_data.tasks.ingest_fund_share_values',
    'app.modules.market_data.tasks.ingest_market_data_series',
    'app.modules.market_data.tasks.ingest_quotes',
    'app.modules.market_data.tasks.ingest_quotes_for_reference_etfs',
    'app.modules.market_data.tasks.ingest_usd_brl',
    'app.modules.market_data.tasks.maintain_data_ingestion_history',
    'app.modules.operations.tasks.maintain_task_run_history',
    'app.modules.portfolio.tasks.consolidate_all_portfolios',
    'app.modules.portfolio.tasks.consolidate_fiis_dividends',
    'app.modules.portfolio.tasks.consolidate_portfolio',
    'app.modules.portfolio.tasks.consolidate_portfolio_returns',
    'app.modules.portfolio.tasks.ingest_etf_holdings_for_held_etfs',
    'app.modules.portfolio.tasks.ingest_fund_share_values_for_held_funds',
    'app.modules.portfolio.tasks.ingest_quotes_for_held_assets',
    'app.modules.portfolio.tasks.recalculate_asset_position',
    'app.modules.portfolio.tasks.recalculate_positions_for_assets',
)

# A task the scheduler sends says so, and its run is recorded as scheduled
# rather than manual. The header rides on the message; the entries stay as
# they are written.
for entry in beat_schedule.values():
    entry.setdefault('options', {}).setdefault('headers', {})['trigger'] = 'scheduled'

celery_app.conf.beat_schedule = beat_schedule
