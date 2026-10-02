from celery.schedules import crontab

#: Every time below is Brasília time; the admin shows them in this zone too.
WORKER_TIMEZONE = 'America/Sao_Paulo'

#: Each entry belongs to one routine in `app.modules.operations.domain.routines`,
#: which is what the admin's operations screen lists. A test fails an entry
#: added here without a routine, and a routine naming an entry not here.
beat_schedule = {
    'ingest-quotes-for-held-assets': {
        'task': 'ingest_quotes_for_held_assets',
        'schedule': crontab(hour='6,12,18', minute=15),
    },
    # After New York closes (17:00 Brasília in the southern summer, 18:00 in
    # winter) and again in the morning, for London's close of the day before.
    'ingest-quotes-for-reference-etfs': {
        'task': 'ingest_quotes_for_reference_etfs',
        'schedule': crontab(hour='7,19', minute=30),
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
    # N-CEN is published quarterly and FIRDS daily; the registry only has to
    # be fresh within the week, and Wednesday keeps it off the CVM's Tuesday.
    'ingest-etf-registry': {
        'task': 'ingest_etf_registry',
        'schedule': crontab(hour='9', minute=30, day_of_week='3'),
    },
    # An ETF's N-PORT is public for the last month of each fiscal quarter,
    # about two months later; a weekly look finds each one within days. A
    # manager's file is daily, and a weekly picture of it is enough.
    'ingest-etf-holdings-for-held-etfs': {
        'task': 'ingest_etf_holdings_for_held_etfs',
        'schedule': crontab(hour='10', minute=0, day_of_week='4'),
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
    'maintain-task-run-history': {
        'task': 'maintain_task_run_history',
        'schedule': crontab(hour='0', minute=5),
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
