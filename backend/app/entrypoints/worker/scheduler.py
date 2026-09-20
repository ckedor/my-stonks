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
    # The registry is published Tuesday to Saturday at 08:00 (Brasília, the
    # worker's timezone); Tuesday picks up the week's registrations.
    'ingest-fund-registry': {
        'task': 'ingest_fund_registry',
        'schedule': crontab(hour='9', minute=0, day_of_week='2'),
    },
    # Share values are published Monday to Saturday at 08:00 (Brasília). The
    # same daily run becomes the weekly revision sweep from Tuesday on, until one
    # succeeds; a value that changes dispatches its own full recalculation.
    'ingest-fund-share-values-for-held-funds': {
        'task': 'ingest_fund_share_values_for_held_funds',
        'schedule': crontab(hour='9', minute=15),
    },
    'maintain-data-ingestion-history': {
        'task': 'maintain_data_ingestion_history',
        'schedule': crontab(hour='0', minute=0),
    },
    'consolidate-portfolios': {
        'task': 'consolidate_all_portfolios',
        'schedule': crontab(hour='6,12,18', minute=30),
    },
    # Uma entrada por feature de IA agendada. O horário fica aqui e não numa
    'consolidate-fiis-dividends': {
        'task': 'consolidate_fiis_dividends',
        'schedule': crontab(hour='4', minute=30),
    },
}
