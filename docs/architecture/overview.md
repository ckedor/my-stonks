# Architecture overview

This document is the starting context for changes that affect the domain,
application boundaries, or main data flows. It describes the intended direction;
when code conflicts with it, do not silently copy the conflicting pattern.

## Product context

My Stonks is a portfolio application whose calculations and visualizations depend
on asset quotes and their scalar prices. Today, most market data is obtained from
Brapi, but providers are an infrastructure detail and may change or coexist.

The primary automatic flow starts with scheduled jobs that ingest quotes for
assets held in users' active positions.

## Main quote flow

```text
scheduler
  -> background task
  -> quote-ingestion service
  -> select assets from active portfolio positions
  -> market-data provider adapter (Brapi or another provider)
  -> normalize provider data into domain quotes
  -> persist quote history
  -> portfolio calculations, caches, and read models
  -> query API
  -> frontend visualizations
```

An authorized user may also trigger ingestion from the frontend. Manual and
scheduled triggers should enter the same service operation when they perform
the same business operation.

## Capabilities and API separation

Quote reading and quote ingestion are separate capabilities:

- **Quote queries** return structured market observations for charts,
  calculations, and other consumers. They are read-only.
- **Quote ingestion** is an operation with side effects, normally executed in a
  background task. Its operational API may trigger a run and expose execution
  status/history.

This separation is by intent, not only by HTTP verb. A `GET` that returns the
status of an ingestion execution belongs to the ingestion capability. A
`GET` that returns asset quote history belongs to the quote-query capability.

Quote queries expose two explicit origins:

- `/market_data/quotes/persisted` resolves registered asset IDs or tickers and
  reads the database only, with at most 100 assets per request;
- `/market_data/quotes/on-demand` accepts one ticker and asset type, calls the
  configured provider, and never reads or writes `Asset` or `Quote`.

Both currently inherit the authenticated `market_data` router. “Public market
page” means a product page outside a portfolio, not anonymous HTTP access. The
on-demand path holds provider responses briefly so that reopening the same
ticker does not spend provider quota again.

`/market_data/fii/{asset_id}/profile` answers the market page of a real-estate
fund with what only a fund has: the indicators it publishes and the dividends it
has paid. It resolves the asset from storage to reject anything that is not a
registered FII, then reads the provider and holds the answer for a few hours —
a fund republishes those numbers once a month, so nothing is persisted and no
calculation depends on them. The two halves come from separate provider routes
and one failing leaves the other on the page.

`/market_data/quotes/asset/{asset_id}` reads storage first and falls back to the
provider. It takes a `currency` and answers in it, converting through the
USD/BRL history when the asset is not quoted in that currency, and reports which
currency the returned quotes are actually in. Conversion is a read concern: it
multiplies by the stored rate direction and never writes converted prices back.
Quotes that cannot be restated faithfully — older than the rate history, or of
unknown currency — are left out rather than guessed at.

## Layer boundaries

- **HTTP routers:** transport concerns only; call services.
- **Services:** business workflow and transaction coordination.
- **Repositories:** database access and persistence queries.
- **Tasks and scheduler:** asynchronous entrypoints into services.
- **Provider adapters:** translate external APIs such as Brapi into domain data.
- **Frontend API clients:** translate HTTP contracts for UI consumers.

Entrypoints delegate workflows to services, while provider and persistence
details remain behind adapters and repositories.

## Persistence lifecycle

SQLAlchemy sessions are infrastructure details and are not passed through HTTP
routes, services, domain code, or Celery tasks.

Write flows use a `UnitOfWork`, which creates one session and the repositories
that share it, commits on successful exit, rolls back on exceptions, and closes
the session. Services define the write transaction boundary.

Simple read flows receive repositories from dependencies or factories that own
the session lifecycle. Reads do not commit. A small shared repository context is
used only where one read needs multiple repositories on the same session.

Application service instances remain stateless after construction. Dependencies
are assigned only in `__init__`; repositories and collaborating services obtained
inside a `UnitOfWork` remain local to that transaction block and never replace
attributes on the service instance. Collaborating services are assembled in the
composition root and injected; application services do not construct one another.

### Persistence mapping

Every persisted entity is a domain dataclass. SQLAlchemy `Table` definitions
live in `infra/db/tables/`, imperative mappings live in
`infra/db/mappings/`, and `infra/db/bootstrap.py` registers the complete model.
There is no second ORM class for the same entity. All mappings share
`Base.metadata` and `Base.registry`, so repositories and the UoW use the same
transaction. Relationships are mapping details; physical cross-module foreign
keys do not require infrastructure entities to leak into application code.

## Market-data ingestion flows

The three persistence operations have distinct entrypoints and one generic
execution tracker:

```text
quote page/task       -> quote ingestion service  -> quote history
series page/task      -> series ingestion service -> market-data series history
USD/BRL page/task     -> USD/BRL ingestion service -> USD/BRL history
                              |
                              -> generic execution and attempt records
```

Series metadata and observations are stored in two different tables:
`market_data_series` identifies and types the series, while
`market_data_series_history` stores its observations. USD/BRL observations are
stored independently in `usd_brl_history`. Ingestion persists only observations
returned by the provider; calendar expansion and missing-date conversion belong
to read/domain flows.

Portfolio position consolidation reads persisted quotes only. Scheduled quote
ingestion runs before portfolio consolidation; missing quote history is an
explicit failure and never triggers a provider call inside the portfolio write
transaction.

### USD/BRL reads and their cache

The rate table is one row per calendar date and never rewrites history, so every
consumer goes through one cached reader that holds the whole table under a
single key and slices it in memory. Keying by start date instead would give each
caller its own entry and almost never hit, since consolidation asks from a
portfolio's first trade, charts from a chosen window, and conversions from a few
days back.

Every read of the rate goes through that reader, including the portfolio flows
that convert transactions, dividends and positions. USD/BRL ingestion drops the
cache after its write commits, along with the index history, which embeds the
rate both as a charted series and as the factor converting USD-denominated
indexes into BRL. Nothing repopulates either: the next read misses and fills.

## Visual architecture map

The frontend route `/architecture` renders a conceptual, read-only map. Its
versioned graph data lives in
`frontend/src/pages/architecture/graph/architecture-map.ts`; update that file
when a main module boundary, scheduler, integration or operational flow changes.

## Domain language

The canonical glossary shared by backend, frontend, and documentation is
`docs/domain.md`.

## Open decisions

- Eligibility and recency rules used to select active positions for scheduled
  quote ingestion.
- Which downstream calculations and caches must run after quote ingestion.
- Whether manual ingestion has different authorization or selection rules from
  scheduled ingestion.
