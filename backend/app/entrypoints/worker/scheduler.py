from celery.schedules import crontab

beat_schedule = {
    'ingest-quotes-for-held-assets-1x-day': {
        'task': 'ingest_quotes_for_held_assets',
        'schedule': crontab(hour='4', minute=0),
    },
    'ingest-market-data-series-3x-day': {
        'task': 'ingest_market_data_series',
        'schedule': crontab(hour='5,13,21', minute=0),
    },
    'ingest-usd-brl-3x-day': {
        'task': 'ingest_usd_brl',
        'schedule': crontab(hour='5,13,21', minute=0),
    },
    'maintain-data-ingestion-history': {
        'task': 'maintain_data_ingestion_history',
        'schedule': crontab(minute='*/5'),
    },
    'consolidate-portfolios-3x-day': {
        'task': 'consolidate_all_portfolios',
        'schedule': crontab(hour='5,13,21', minute=5),
    },
    'consolidate-fiis-dividends-1x-day': {
        'task': 'consolidate_fiis_dividends',
        'schedule': crontab(hour='4', minute=30),
    },
}
