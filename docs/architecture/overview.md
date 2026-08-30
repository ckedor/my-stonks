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
fund with what only a fund has: who runs it, the indicators it publishes and
their history, the payments it has made, its latest monthly filing, and the
composition of what it holds — properties, CRI, shares in other funds, land and
rights — with the history of that composition and of its vacancy. It resolves
the asset from storage to reject anything that is not a registered FII, then
reads the provider and holds the answer for a few hours — a fund republishes
those numbers monthly at best, so nothing is persisted and no calculation
depends on them.

Seven provider routes answer for that one read, asked for together under the
same concurrency cap the dividend ingestion uses, and read independently: one
failing leaves the other sections on the page, and only all of them failing
raises, so an expired token or a spent quota reaches the reader as itself
rather than as a page of empty cards. They also answer on different clocks —
the indicators and the filing monthly, the composition quarterly and months
late — which is why every section carries the date it refers to instead of the
page carrying one.

`/market_data/investment_fund/{asset_id}/profile` answers the market page of
every other kind of fund — a FIAGRO, an FI-Infra, a FIDC, a FIP, an ordinary
FIF — with what those publish instead of buildings: their registration, the
figures they report about themselves, the share value they file, the payments
they have made, the monthly picture the regulator asks of some of them, and the
quarterly filing of what they hold. It resolves the asset from storage to reject
anything that is not a registered investment fund, then reads the provider and
holds the answer for a few hours, on the same terms as the real-estate profile
and for the same reason.

Six provider routes answer for that one read, under the same concurrency cap and
read independently: one failing leaves the other sections on the page, and only
all of them failing raises. They also answer on different clocks — the
registration and the indicators as often as the fund files, the share value
daily for an FI and monthly for a FIDC, the regulatory profile monthly, the
portfolio quarterly and months late — which is why every section carries the
date it refers to.

The two profiles are separate because the funds are. A real-estate fund is read
through vacancy and buildings and has provider routes of its own; the rest are
read through share value, equity and the credit they carry. So
`/market_data/investment_fund/market` serves the catalogue minus real-estate
funds and ETFs, filtered on the kind the provider states and never on the
ticker: a code ending in 11 says nothing about which of them a fund is, and
JURO11 is an FI-Infra.

The six groups of the quarterly filing — public bonds, shares in other funds,
credit assets, listed securities, receivables and payables — arrive in one
shape and are served as one list whose lines name their own group. Receivables
and payables are a claim and an obligation rather than things owned, so the
group has to travel with the line: summed blindly, a payable would inflate what
the fund holds.

The same route feeds the portfolio. A daily job records what a portfolio's
funds paid, reading `/v2/fii/dividends` through the same adapter mapping the
market page uses, so a payment is one fact on both sides. It records income
only: an amortization returns principal, and the provider's label is the only
thing separating the two — the job read a source that published no label at
all, so every amortization used to land in a portfolio as income.

How many shares a payment is worth is settled on its ex date, and the amount is
recorded on the payment date. Those are different days, and using the payment
date for both paid nothing to whoever sold between them: the position series
stops at a full exit, so on the day the cash arrived there was no row left to
read a quantity from. Whether a payment is already recorded is read from the
dividends themselves rather than from that row, for the same reason. A dividend
entered by hand is never overwritten.

Provider units survive the boundary unscaled. Yields are ratios and P/VP is a
multiple, as published; the client decides how each is written. Amounts paid per
share are read from what the provider states was paid, never derived from a
yield, and a payment's own label is carried through so that an amortization of
capital is not read as income.

`/market_data/quotes/asset/{asset_id}` reads storage first and falls back to the
provider. It takes a `currency` and answers in it, converting through the
USD/BRL history when the asset is not quoted in that currency, and reports which
currency the returned quotes are actually in. Conversion is a read concern: it
multiplies by the stored rate direction and never writes converted prices back.
Quotes that cannot be restated faithfully — older than the rate history, or of
unknown currency — are left out rather than guessed at.

`/market_data/market/{kind}` answers a market catalogue — the provider's whole
universe for one class of instrument, one class per call: `stock`, `etf`, `fii`,
`bdr` and `crypto`. It is a provider read held in cache for six hours, enriched
with the id of the asset the application already has registered for each ticker,
so a screen can link a listed instrument to a registered one without a second
round trip.

`POST /market_data/asset/sync` is the write that pairs with it, and the only
place the registry takes dictated data from a provider. It is a merge, not a
replacement: a ticker in both sides has its name and logo corrected from the
catalogue, a ticker only in the catalogue becomes a registered asset on the
Brazilian exchange, and a ticker only in the registry is left alone — fixed
income, Treasury bonds and pension funds are in no catalogue, and they carry
portfolio history. It is manual and defaults to `dry_run`, because it rewrites
names screens display: the report says what would change before anything does.

## Portfolio segment reads

A specialized screen is about one **portfolio segment** — one part of the
portfolio, defined by asset-type ids and, where the same type trades in two
markets, by which market. Ids, because `asset_type.short_name` is product copy
in pt-BR and not a code. The definition lives in one place,
`app/modules/portfolio/domain/portfolio_segment.py`, and nothing else decides
it:

- the current-position payload carries each position's `segment` and its
  `exchange`, so the frontend filters by an answer rather than re-deriving the
  rule;
- `/portfolio/position/{id}/segment/{segment}/returns` and `.../analysis`
  answer for the segment, and `patrimony_evolution` takes a `segment`
  parameter.

Every segment has a consolidated series, including the ones that cut a type by
market or gather several types. Those had none until the return tables were
unified, which is why reading one used to be a computation and reading a
whole-type segment used to be a select — one screen, two code paths. Now they
are all scopes of `portfolio.return_series`. An empty segment answers with
nothing, never with the whole portfolio.

## Consolidated reads

A portfolio's derived data is four things at four altitudes — the portfolio, a
custom category, an asset type, a segment — and one arithmetic: each position
weighs by what it was worth the day before, the weighted returns are summed per
day, and the daily series is compounded and annualized. So there is one table,
`portfolio.return_series`, discriminated by `scope` and `scope_key`, and one
consolidation that fills every scope in a single pass.

`scope_key` is text and not a foreign key, because it points at a different
table depending on the row. That is the price of one table, and it is paid where
rows are deleted: removing a category or a portfolio has to remove its series
explicitly, the way the portfolio delete already clears positions and
transactions by hand.

Consolidating a portfolio is one run, `consolidate_portfolio`: it recalculates
the positions, rebuilds every return series from them, and stamps
`portfolio.portfolio_consolidation` with when it finished and whether it worked.
One stamp per portfolio, because every series below is rebuilt in the same run —
a stamp per series would be the same instant repeated.
`/portfolio/position/{id}/consolidation` is where a screen reads it, once, to
label the whole page.

None of these reads is cached. They are selects from a consolidated table, so
the consolidator's commit is the only thing that changes what a reader sees.
Patrimony evolution is the exception and the only portfolio read still computed
per request, which is why it is also the only one with a cache in front of it.

## Layer boundaries

- **HTTP routers:** transport concerns only; call services.
- **Services:** business workflow and transaction coordination.
- **Repositories:** database access and persistence queries.
- **Tasks and scheduler:** asynchronous entrypoints into services. A task is
  built by the composition root and never assembles its own `UnitOfWork`, and
  nothing dispatches a task by importing it — importing one pulls its service,
  adapters and provider into the calling process, so an entrypoint enqueues by
  name through `run_task_by_name`.
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

Reads open the same `UnitOfWork` scope and leave without committing. There is no
separate path for them: a service never receives a repository, and the unit of
work is the only way into persistence.

Building an entity from a dict never sets a relationship the caller did not
name. A persisted entity is a dataclass, so its `__init__` assigns every field
and an unmentioned relationship arrives as None, which SQLAlchemy reads as "no
related row" and writes over the foreign key underneath it. The repository drops
those before the flush.

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
indexes into BRL. Series ingestion drops that same index history, since it writes
the observations the read is built from. Nothing repopulates either: the next
read misses and fills.

### Who invalidates a cached read

The service that commits the write drops the reads that write makes stale, at the
end of its own transaction. Not the caller, because a caller that dispatched a
background task has not waited for anything: it empties the cache while the old
rows are still the ones in the table, the next reader refills it with them, and
the stale answer survives a whole TTL. So the returns consolidator drops the
asset-type and segment series it just wrote, and quote and series ingestion drop
what they wrote.

What a caller may invalidate is what it awaited. A route or task that recalculated
positions and got the commit back drops the patrimony series derived from them.
Deleting a portfolio is the one write with no consolidation behind it, and
therefore the one place that drops every read of a portfolio from outside.

Invalidation matches a prefix of the cached key, and that key is built from the
call's arguments in signature order after defaults are applied — not from how the
caller wrote the call. Keying on the call shape made `f(1)` and `f(portfolio_id=1)`
two different entries, only one of them under the prefix that deletes them, with
nothing raising when the other escaped. `tests/infra/test_cache_key_invalidation.py`
holds the two sides together.

A cache is optional infrastructure. A read whose cache is unreachable is slow,
never failed, and a `None` answer is not stored, since it reads back as a miss.

## Visual architecture map

The frontend route `/admin/architecture` renders a conceptual, read-only map.
Its versioned graph data lives in
`frontend/src/pages/admin/architecture/graph/architecture-map.ts`; update that
file when a main module boundary, scheduler, integration or operational flow
changes.

## Domain language

The canonical glossary shared by backend, frontend, and documentation is
`docs/domain.md`.

## Open decisions

- Eligibility and recency rules used to select active positions for scheduled
  quote ingestion.
- Which downstream calculations and caches must run after quote ingestion.
- Whether manual ingestion has different authorization or selection rules from
  scheduled ingestion.
