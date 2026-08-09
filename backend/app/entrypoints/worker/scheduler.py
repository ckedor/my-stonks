from celery.schedules import crontab

beat_schedule = {
    'ingest-quotes-for-held-assets': {
        'task': 'ingest_quotes_for_held_assets',
        'schedule': crontab(hour='6,12,18', minute=15),
    },
    'ingest-market-data-series': {
        'task': 'ingest_market_data_series',
        'schedule': crontab(hour='5,13,21', minute=0),
    },
    'ingest-usd-brl': {
        'task': 'ingest_usd_brl',
        'schedule': crontab(hour='5', minute=0),
    },
    'maintain-data-ingestion-history': {
        'task': 'maintain_data_ingestion_history',
        'schedule': crontab(hour='0', minute=0),
    },
    'consolidate-portfolios': {
        'task': 'consolidate_all_portfolios',
        'schedule': crontab(hour='6,12,18', minute=30),
    },
    'consolidate-fiis-dividends': {
        'task': 'consolidate_fiis_dividends',
        'schedule': crontab(hour='4', minute=30),
    },
}
