# Architecture overview

This document is the starting context for changes that affect the domain,
application boundaries, or main data flows. It describes the intended direction;
when code conflicts with it, do not silently copy the conflicting pattern.

## Product context

The admin city sandbox (`/admin/game/sandbox`) uses one fixed terrain map
from `frontend/src/components/city-game/map.ts`: mainland to the north, two
big islands facing each other across a strait with one islet in it, and three
outer islands — south, southwest and a desert one to the east, whose land is
drawn in sand (`grounds` on the terrain). `AppIsoBuilder` renders the supplied land polygons
and checks placement footprints against land before placing or moving pieces.
Terrain is independent of the browser-persisted pieces in `game-sandbox`;
clearing those pieces preserves the map. Existing pieces are retained when
the terrain changes. The map spans 512 × 512 tiles. The sandbox opens with
an overview of the editable area. Water and mainland continue beyond the
512 × 512 tile board as non-editable scenery. Zoom stops at the playable
board's overview. Panning stays centered at that zoom and opens progressively
within the playable area as the camera zooms in. Scenery only fills the
viewport margins, hiding the mainland's artificial outer boundary.
The terrain also supplies one river, reaching the sea through a single
mouth, and the coastlines that get the same strip of sand and shallows all
the way round. The river uses the sea color and is excluded from placement
checks; both land and water availability are checked lazily per tile and
cached, so opening the map does not scan the full board.
The camera turns in quarter turns; placements stay in board tiles and only
drawing and pointer picking go through the turn. Roads, avenues, sidewalks
and lawns are laid by dragging a straight line.

The shared catalogue groups housing under **Residencial**, with **Casas**,
**Prédios pequenos**, **Prédios médios** and **Prédios grandes** submenus;
urban buildings, office towers and skyscrapers share **Prédios**, with
**Edifícios urbanos**, **Torres** and **Arranha-céus** submenus. Every group
has submenus — `IsoBuilderItem.subgroup` is required — so the shop keeps its
height from tab to tab; asset sculptures are split by asset type, and pending
pieces by their own submenus. Pieces and submenus are ordered cheapest first,
with the volume breaking ties, which also orders the free sandbox the same
way. The builder remembers the chosen submenu per group during the session.
A selected piece shows its height and volume, measured from the same solids
as the price (`recipeMeasure` in `iso/engine.ts`): trees, masts and ground
count for neither. Existing catalogue ids keep rendering saved neighbourhoods.
`iso/residential.ts` supplies houses, terraces, villas and apartment courts
in a common muted slate/terracotta/plaster palette. Houses have 3 m storeys,
roughly 5.5–8 m frontages, porches and gardens on the existing 12 m tile grid.
The vegetation primitive in `iso/engine.ts` now draws irregular layered
canopies and ground shadows wherever a recipe calls `tree`, including roof
gardens. Tree height follows the metres ruler (about 11 m at size one), and
its shadow contributes no built volume. `iso/vegetation.ts` adds tree variants,
groves, dense woodland, a garden walk and an orchard.

An asset is rendered as a sculpture on a thick civic stone pedestal
(`frontend/src/components/ui/iso/asset-sculpture.ts`). The class selects the
silhouette: an ETF bull, a stock flame, an FII tortoise carrying a house, a
fixed-income piggy bank, an FI octopus, a Treasury shield or a crypto phoenix.
FI has its own game type; saved fixed-income ids resolve through current
portfolio types so investment funds adopt the octopus. The pedestal has the same design
and black-and-gold identification on every side. Gold, silver, bronze, stone, wood,
topiary, glass and a yellow-to-red fire gradient are player-selected finishes, available while placing or
selecting a sculpture. The finish is encoded in the item's persisted id;
old ids without it remain readable and use bronze (fire for crypto). Portfolio holdings supply
the actual class for legacy ids that grouped ETFs with stocks or bank notes
with Treasury bonds. Position types are display labels (`Cripto`, `Tesouro`),
so the city adapter accepts these labels as well as its canonical sandbox codes;
legacy BTC ids mistakenly saved as STOCK resolve to the phoenix recipe. Changing finish preserves placement, value, uniqueness
and footprint; growing preserves the chosen finish.

The artwork's mesh volume is normalized before uniform cube-root scaling by
holding value in USD: US$ 20,000 has 200 times the artwork volume and about
5.85 times each dimension of US$ 100. The latest adjustment doubles all
linear dimensions (eight times the volume), consistently across asset classes.
The stone pedestal fills the exact rectangular tile footprint, rounded up to
whole cells; this grid rounding means its volume is not strictly proportional.
Statues stand directly on the masonry pedestal, without additional grass,
water, fire or terrain surfaces. The octopus retains its original authored
boulder inside the animal mesh, with no extension or deformation to fill the
pedestal footprint. The entire octopus cast (animal and boulder) is uniformly
enlarged by 20% on all three axes relative to its unchanged pedestal; terminal
tentacles may overhang it. This multiplier is constant across holding values.
Crypto uses the approved transparent reference cutout at
`frontend/src/assets/sculptures/phoenix.png`, loaded by `iso/phoenix-sprite.ts`.
The old procedural phoenix mesh is removed. Its pose and brown/gold colors
are fixed: camera rotation turns the pedestal but retains the sprite view,
and crypto offers no material selector. Saved material-bearing IDs remain
readable. Sprite width and height follow the same cube-root wealth scale;
a nominal cubic artwork volume is used for measurements, not a reconstructed
3D mesh volume. The masonry pedestal still carries ticker and dollar value.
`iso/sprite-images.ts` notifies the builder after image loading, invalidating
board sprites and shop thumbnails. Export recipes await their image dependency
before rendering. No external image host is required at runtime.
The prior US$ 200,000 value cap and legacy growth threshold remain.
Ground surfaces render before the combined shadow pass and solid geometry,
so neighbouring lawns cannot cut tree shadows. Pine catalogue entries are
hidden; saved pine placements render as broadleaf trees.
On opening a saved city or sandbox, asset layout revision 21
checks footprints against other pieces, the board and land. Any piece left
in water — revision 21 redrew the bay — moves to the existing pending tray;
among pieces that only overlap, just enlarged assets move, preserving their
value and material. This reconciliation happens once and does not delete
pieces. The resized Woolworth is also reconciled; other decorative buildings
that still stand on land keep their positions. The shop's price ruler remains 9.5 m³ per USD and is independent of the
sculptures' miniature visual scale.

The bull is an original continuous anatomical mesh generated by
`frontend/scripts/sculptures/bull.py`, checked in as `iso/models/bull.json`.
Its smooth normals and depth-tested metallic surfaces are rendered offscreen
by `iso/sculpture-surface.ts` while baking the ordinary canvas sprites; the
board still composites cached sprites and supports all four camera turns.
The octopus includes a broad sculpted boulder in the same mesh and material,
a lower bulbous mantle, eight long curling arms and thin scalloped membranes
between their roots. Its total sculpture volume, including the boulder,
follows the holding value.
The tortoise, piggy bank and octopus are authored by
`frontend/scripts/sculptures/animals.py` with the same continuous mesh pipeline.
Silver uses a cool neutral metallic reflection rather than the warm gold one.
Asset items also supply an `appearanceKey`: sprites, measurements and thumbnails
use the resolved class and visual revision rather than just the persisted id.
An old fixed-income id can therefore display the new FI mesh without reusing
a cached piggy bank or an earlier octopus.
The scenic ground and animal share a depth-tested mesh, so flames, waves and
the sculpture occlude correctly in every camera turn. Authored RGB paint is
carried per vertex; unpainted vertices retain the selected sculpture finish.
Canvas shading remains the fallback if WebGL is unavailable.

Growing is never automatic: the builder offers an upgrade on a selected
asset, takes it off the board and keeps its successor pending (persisted with
the placements) until the player puts it down. In the sandbox the upgrade
target is the value chosen in the picker above the map.

The player's game is `/portfolio/city` ("Cidade"; `/portfolio/city-builder`
redirects there), on the same
512 × 512 map. It reads the selected portfolio's positions and dividends in
USD whatever the currency selector says, and keeps one city per portfolio in
the browser (`city-game` in `frontend/src/stores/city-builder.ts`). Money is
the city balance (`frontend/src/components/city-game/economy.ts`): current
value plus received dividends plus the city bonuses
(`frontend/src/components/city-game/bonuses.ts`, from the USD patrimony
history, category returns and benchmark series), minus what is built, shown in
a foldable panel on the map. Dividends not yet announced open a popup once;
which ones were seen is kept with the city in the browser. The city tier
(`frontend/src/components/city-game/tiers.ts`) heads that panel as a progress
bar, so it stays in view in full screen, with the month the next tier is
projected from the USD CAGR and average monthly contribution; the bonuses
fold into one row that opens to their parts. The territory
(`frontend/src/components/city-game/territory.ts`) passes the regions open at
the current tier to the builder as `buildable`: the camera frames and stays
within the box round them, and land outside them refuses new pieces. A shop item costs a tenth of its
built volume at the asset-building ratio, measured from its drawing
(`isoPieceVolume`); roads and the plain tree are free, and asset buildings
are free and unique per asset. An asset building is flagged for upgrade when
its asset is worth at least one more floor than the building on the map.

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
round trip. Each B3 row also carries the provider's sector and subsector.
`stock-us` and `etf-us` are not the provider's: they are the registry's assets
outside the B3 with their latest stored quote.

`/market/assets` is built on these catalogues and on the reference ETF
readings. It opens with the assets the user visits most, each with today's
price — the portfolio stays in the portfolio's own screens — then the leaders of each
category, each ranked by the measure that exists for it (ten-year growth for
the reference ETFs, market value for B3 stocks, one line per company, money
traded for B3 stocks and ETFs and crypto, shareholders for FIIs), and ends in a
screener with the reference ETFs as the first tab and the whole registry in the
last. The screen reads the fund catalogue as FIIs only when
`/market_data/fii/market` knows the ticker: the provider lists index ETFs, the
Ibovespa itself and FIAGROs as funds too. The sector map of the largest B3
companies is the Brasil tab of `/market/overview`.

`POST /market_data/asset/sync` is the write that pairs with it, and the only
place the registry takes dictated data from a provider. It is a merge, not a
replacement: a ticker in both sides has its name and logo corrected from the
catalogue, a ticker only in the catalogue becomes a registered asset on the
Brazilian exchange, and a ticker only in the registry is left alone — fixed
income, Treasury bonds and pension funds are in no catalogue, and they carry
portfolio history. It is manual and defaults to `dry_run`, because it rewrites
names screens display: the report says what would change before anything does.

`POST /market_data/asset/registry_sync` is the other write into the registry,
and it reads the regulator rather than a provider. It fills
`asset.institution` from the CVM registry of listed companies and from the
administrators the fund registry already carries, then resolves each stock to
the company that issued it through the registration form, whose
`valor_mobiliario` member is the only place in CVM open data that ties a
negotiation code to a CNPJ. It also fills the exchange and the share class,
which is what stops the market rule from depending on the shape of a ticker.

Its guards come from what the files actually contain. The negotiation code is
free text and filers abuse it — `ADR`, `4030`, `000000` — so a code that is not
shaped like a B3 ticker is dropped. The form carries securities that left the
exchange decades ago, so only the ones still trading identify an asset, and a
ticker that appears solely among the ended ones marks the asset delisted. And
only Brazilian assets are matched at all, by the same rule the segment uses: a
CVM file cannot describe a Nasdaq stock, and `PNC` is a live American bank here
and a company that left the B3 in 1996 there.

A FII or a Brazilian ETF is tied to the regulator's fund registry, which the
weekly ingestion already writes without filtering by fund kind — the cadastre
is in the database before anybody links to it. `GET
/market_data/asset/fund_link/suggestions` proposes the link for FIIs, pairing
the CNPJ the provider states with the registered fund; a CNPJ naming more than
one registration comes back ambiguous rather than guessed. `POST
/market_data/asset/fund_link` confirms one, and it is also how an ETF is
linked, since no catalogue publishes an ETF's CNPJ: the fund is found through
`GET /market_data/fund_registry/fund` and confirmed by hand.

A foreign ETF is tied to the ETF registry instead, which the weekly
`ingest_etf_registry` writes from three public sources, each one attempt of
the execution (`/market_data/ingestions/etf_registry`), so one failing spares
the others:

```text
weekly (Wed 09:30) + manual  "Cadastro de ETFs estrangeiros"
  ingest_etf_registry -> EtfRegistryIngestionService
    1. SEC:   company_tickers_mf.json + the last four N-CEN data sets
              (+ EDGAR, per series, for the app's ETFs no data set carries)
              -> asset.etf_registry / _class / _manager, asset.institution by LEI
    2. FIRDS: every EU-traded ETF class but the American ones, by ISIN
       GLEIF: relationship golden copy (manager, umbrella) + LEI records
              -> the same tables
    3. Links: asset.etf.etf_registry_class_id — by ISIN when the asset has one,
              by the SEC's current ticker for an American listing
```

What each held ETF owns is a routine of its own. The portfolio task
`ingest_etf_holdings_for_held_etfs` picks the ETFs recently held, as the quotes
do, and chains into `ingest_etf_holdings`, one attempt per ETF: the series'
latest N-PORT is found through EDGAR's full-text search — the only index that
tells one series' filing apart among the hundreds a trust files each quarter —
skipped when that accession is the one stored, and otherwise read and written
in one transaction to `asset.etf_holding_report` and `asset.etf_holding`.
A UCITS ETF files no holdings with any regulator, so for a class listed in
`MANAGER_HOLDINGS_FILES` (`market_data/domain/etf_registry.py`) the attempt
reads its manager's file instead — DWS's constituents spreadsheet, by ISIN,
through `infra/integrations/dws_client.py`, or the holdings CSV of an iShares
product page, by product id, through `infra/integrations/ishares_client.py`;
both read in `market_data/adapters/etf_manager_files.py` — and writes it to the same
tables with its own `source`, skipped when that date is already stored from
it. The reader fails a file whose header, date or weights do not add up to the
fund rather than guess, since nothing promises the layout of a page made for
people. Every other UCITS class is listed in the run as having no source.
The same run ends with one more attempt that ties American holdings to
assets; a UCITS fund's holdings are tied only to assets already carrying
their ISIN, as they are written. A filing gives each holding's ISIN and no ticker, and American stocks are
registered by ticker, so the ISINs no asset carries are asked of OpenFIGI
(`OPENFIGI_API_KEY` is optional and only raises its rate limit); a ticker that
names exactly one American asset gives that asset its ISIN, never replacing
one, and every unlinked holding is then pointed at the asset with its ISIN.
`/market_data/etf/{asset_id}/profile` and `/holdings` serve the market page
from storage, the holdings a page at a time, largest weight first.

The shape follows from what the sources contain, measured on 2026-09-25. An
American fund is keyed by its SEC series and a UCITS fund by its LEI, because
BondBloxx files one LEI for 27 series. The N-CEN data sets leave out about one
ETF filing in fourteen that EDGAR holds, which is why the app's own ETFs are
completed from EDGAR, per series: a trust whose funds close their years on
different dates files one N-CEN per group. An open-end fund listed on an
exchange is read as an ETF even without the ETF box, which 42 filers left
unchecked. A FIRDS class whose issuer LEI is an umbrella and not itself a
sub-fund is left out, since which sub-fund it belongs to is not in the data.
London left FIRDS with Brexit, so a London listing reaches its class through
the ISIN on the asset, which a migration sets and nothing infers. The SEC
refuses anonymous clients: `SEC_USER_AGENT` names who is asking, and without it
the SEC step fails and says so.

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

### Incremental position consolidation

Routine manual and scheduled consolidation passes `incremental=True` to the
position consolidator. For assets priced from persisted quotes, with no corporate
events, it resumes from each asset's latest persisted position date minus 15
calendar days. It requires a position on the preceding day; a missing checkpoint,
a short or absent history, corporate events, fixed income and Treasury bonds use
the full calculation.

The incremental calculation reads recent quotes and exchange rates, continues
quantity and accumulated returns from the opening position, and retains the
original start date and historical return lookups for CAGR and twelve-month
returns. Transaction history is still read to preserve average-cost semantics;
persisted positions from the last year plus the overlap supply the checkpoint
and historical lookups, with the first position retained for the inception date. Only
the daily tail is calculated and replaced, with its deletion and insertion in
one transaction. Deleting the tail also removes dates that no longer have a
position after a sale. Aggregate return series still rebuild in full.

Transaction and manual dividend writes dispatch the full asset recalculation
after commit. For funds priced from regulator filings, that task first awaits
share-value ingestion for the earliest purchase across portfolios, then reads
the persisted quotes to consolidate. A failed or incomplete ingestion stops
the recalculation and fails the task. Successful ingestion with unchanged quotes
still recalculates the new transaction. Changed quotes also rebuild other
portfolios holding the asset; those follow-up tasks skip ingestion to avoid a
loop. Consolidation failures propagate to Celery instead of being logged as
success. Moving a transaction between assets or portfolios rebuilds both
its old and new positions. Newly ingested FII dividends likewise dispatch a full
recalculation for each affected asset, including payments older than the overlap.
The explicit asset/full-position recalculation routes retain full rebuilding;
use them after historical quote or exchange-rate corrections outside the overlap.

## Recommendation ingestion

A recommended portfolio published by a research house enters through a PDF, and
the flow that reads it is deliberately in two halves:

```text
upload (PDF)
  -> extraction service
  -> AI provider, with the document attached
  -> parse the model's JSON into a reading
  -> resolve each ticker against the asset catalogue
  -> draft returned to the screen         (nothing persisted)

reviewed draft
  -> recommended-portfolio service
  -> resolve or create the research source
  -> persist the edition and its positions
```

The first half writes nothing. What comes back from `POST
/research/recommended_portfolio/extraction` is a reading, not a record: a model
extracted it from a document, and a weight nobody confirmed has no business in
the database. The screen shows what was read, the person corrects it, and
`POST /research/recommended_portfolio` is what creates rows.

The PDF goes to the provider as a document rather than as text pulled out of it
first. The tables in these reports *are* the recommendation, and a text
extraction of a two-column layout arrives with the tickers in one order and the
weights in another.

Tickers are resolved against the catalogue in one query, and the answer has
three outcomes, not two: found, not registered, or registered more than once.
The service links only the first. A line whose ticker is unknown keeps its
ticker and no asset — dropping it would silently change the weight of every
line that stayed — and an ambiguous one is left for the reader, because
guessing between two assets links a recommendation to the wrong one without
saying so.

`research` is its own module and its own schema. A recommended portfolio
belongs to the house that published it, not to a user or to a portfolio: the
same edition is the same fact for everyone, which is why it does not live under
`portfolio`. It reads assets through the unit of work, like every other module,
and imports no other module's repositories.

What is persisted is what a later measurement of the recommendation needs: the
source, the reference month, the weights, and the rationale the report gave.
Nothing computes performance today — the data it would need is in place.

## Brokerage note import

A brokerage note enters the portfolio the way a recommendation enters research:
the reading writes no transaction, and a person confirms before any is stored.
The PDF itself is the exception — it is kept as a portfolio document the moment
it is uploaded (see **Portfolio documents**).
It lives in `portfolio`, which owns transactions, and calls the AI provider
through an adapter (`modules/portfolio/adapters/brokerage_note_extractor.py`),
as research does — not through the `ai` feature module, whose artifacts are
prompt-versioned and cached by input.

```text
upload (PDF) + portfolio
  -> POST /portfolio/brokerage_note/extraction
  -> keep the PDF as a portfolio document                    (the one write)
  -> AI provider, document attached, answer constrained to a schema
  -> app checks each note's own totals and splits fees across its lines
  -> broker by CNPJ, else by registered name; asset by ticker — the B3 code in
     the ticker or the specification (BRL), the symbol column (USD)
  -> per note: reconcile against the portfolio's transactions,
     and flag a note already imported (same broker and number)
  -> draft, with the document's id                     (no transaction persisted)

asset or broker chosen on screen
  -> POST /portfolio/brokerage_note/reconciliation     (no model call)

one note confirmed
  -> POST /portfolio/brokerage_note
  -> reconcile again; refuse with 409 if it changed
  -> save the note (update it if already imported), linked to its document, then
     create / update / replace its transactions, linked to it, in one unit of work
  -> recalculate_asset_position per affected asset

history
  -> GET /portfolio/brokerage_note?portfolio_id=
```

Three document families are read: the Brazilian Sinacor note (BRL), the US
trade confirmation (USD, Avenue/Apex), and an account statement that shows fund
subscriptions and redemptions (BRL, BTG's "Extrato da Conta Investimento") —
each movement date there becomes one note, with no note number. A line's asset
is found by its ticker; a fund line has none and is found by the class CNPJ the
statement prints. A note's currency must be its broker's;
a USD line is stored with `price_usd` as printed and `price` from the day's
rate, the reverse of a BRL line. Everything that is stored — the note header
and every line — is editable on screen before confirming, and each edit
re-runs the reconciliation.

The screen is the Trades page's "Importar nota" tab. Each note in a PDF is
confirmed on its own: it is the unit the broker issued and the unit stored in
`portfolio.brokerage_note`, and confirming one does not force a decision on the
others.

Numbers the screen trusts come from the application, not the model. Each line
must equal quantity times price, the lines must add up to the note's operations
total, and sales minus purchases minus fees and withheld tax must equal the net
amount. A mismatch is shown on the note; it means a line was misread.

A note is not the identity of a transaction, so reimporting is matching by
content. Lines are grouped by asset, broker, trading day and side, and each
group gets a proposal (`modules/portfolio/domain/brokerage_note.py`): new; the
same lines already recorded (unchanged, or updated with the fees and settlement
date the note adds); a manual aggregate with the same total and average price
(replaced by the note's executions); or a conflict — a different quantity, or
the same trade under another broker — which is skipped unless the person says
otherwise. The write re-runs the matching and compares the transaction ids each
decision was taken over, because a decision taken on a stale screen would
delete a transaction nobody reviewed.

## Position check

A broker statement is read the same way as a brokerage note — the PDF goes to
the provider as a document, through an adapter inside `portfolio` — but nothing
other than the PDF itself is ever written:

```text
upload (PDF) + portfolio
  -> POST /portfolio/position_statement/extraction
  -> keep the PDF as a portfolio document
  -> AI provider, answer constrained to a schema
  -> broker by CNPJ or name, asset by ticker
  -> compare: statement quantity per asset vs. the portfolio's transactions at
     that broker up to the statement date, splits applied      (nothing persisted)

statement or history corrected on screen
  -> POST /portfolio/position_statement/comparison     (no model call)
```

The comparison lives in `modules/portfolio/domain/position_statement.py`. The
screen is the Trades page's "Bater posição" tab: selecting a diverging asset
lists its transactions at that broker, flags those without a brokerage note, and
opens the ordinary transaction form to fix them.

## Portfolio documents

Every PDF uploaded to a portfolio — a brokerage note, a position statement — is
kept, so the history of what was sent survives the reading. The bytes live in a
bucket and the database keeps the rest:

```text
upload (PDF, already checked to be one)
  -> PortfolioDocumentService.store                 (before the model is called)
  -> sha256 of the content -> key portfolio/{id}/{kind}/{sha256}.pdf
  -> DocumentStorage.put  (app/infra/storage/, S3 protocol: R2, B2, AWS, local S3Mock)
  -> portfolio.document: find by (portfolio, kind, sha256), else insert

GET /portfolio/document?portfolio_id=                 the history, newest first,
                                                       with the notes confirmed from each
GET /portfolio/document/{id}/content?portfolio_id=    the file, through the API
DELETE /portfolio/{id}                                 objects, then rows, then the portfolio
```

A document is kept before the model is asked, because it was uploaded whether or
not the reading works or anybody confirms what it says. Keeping it is not
agreeing with it: the transactions still wait for a confirmation. The same
content uploaded again for the same purpose is the same document, which is why
the key comes from the content rather than from a row id — an upload that
reached the bucket and failed before the database leaves an object the next
upload of that file lands on, not an orphan.

A confirmed brokerage note points at the document it was read from
(`portfolio.brokerage_note.document_id`, `SET NULL`); a note confirmed with no
document keeps whatever link it had. The file is served through the API rather
than by a signed link to the bucket, so the bucket never has to be reachable
from a browser.

The storage is optional infrastructure on the cache's terms, with one
difference. With no bucket configured (`STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`,
`STORAGE_SECRET_ACCESS_KEY`, and `STORAGE_ENDPOINT_URL` outside AWS) a PDF is
read and not kept, and the reading says so with a null `document_id` that the
screen shows. With a bucket configured, failing to keep the file fails the
upload: a history with holes nobody sees is worse than an error.

## Income tax assessment

The tax belongs to the taxpayer, and the taxpayer is the user: one CPF, every
portfolio and every broker. The monthly exemption, the average cost and the loss
to carry are added across all of them, so the assessment reads the user's
portfolios together and never one portfolio alone.

```text
GET /portfolio/income_tax/assessment?fiscal_year=
  -> every transaction of every portfolio of the user, with what classifies it
     (asset type, exchange, ETF segment, the fund kind the regulator files)
  -> corporate events of those assets, and the user's DARF payments
  -> domain/income_tax (pure, Decimal):
       classify each asset into its tax kind
       ledger: average cost per asset, fees in the cost and out of the sale,
               events applied once in date order
       assess every regime month by month, from the first sale in the history
       assess investments abroad year by year, from 2024 (Lei 14.754/2023)
       DARFs per revenue code and month, R$ 10 minimum, reconciled with payments
       pendencies for what the data cannot decide
  -> the fiscal year's months, sales, DARFs and pendencies   (nothing persisted)

POST /portfolio/income_tax/darf_payment          (the only write)
DELETE /portfolio/income_tax/darf_payment/{id}
```

The code lives in `app/modules/portfolio/domain/income_tax/`, and
`PortfolioIncomeTaxService` only reads the facts through the unit of work and
hands them over. Nothing of the assessment is stored: it is derived from
transactions, events and payments and is cheap to recompute, so storing it would
be a second truth to invalidate on every trade. The one table is
`portfolio.darf_payment`, because whether a DARF was paid is a fact only the user
knows, and inferring it from the tax would show an overdue tax as settled.

The whole history is assessed on every read, because January's loss to carry is
December's, and December's comes from every month before it. The history is
taken as complete; there is no opening balance to enter.

Three regimes are assessed, each with its own rule, loss and withheld tax:
common operations (stocks, equity ETFs and BDRs traded in Brazil — only stock
sales count toward and benefit from the R$ 20,000 exemption), real-estate funds
(FII, and a listed fund the regulator files as Fiagro), and crypto held with a
Brazilian broker (capital gain: R$ 35,000 exemption, progressive rates, no loss
offset). A fixed-income ETF is taxed at source and stays out of the DARF; a
Brazilian ETF without a segment is an equity ETF, with no pendency. A sale of a
listed fund that is neither FII nor Fiagro is a pendency: that regime is not
assessed yet.

Assets abroad — stocks, ETFs and REITs at a foreign exchange, and crypto at a
USD broker — are a fourth, annual assessment (`income_tax/foreign.py`): no DARF,
15% in the yearly return. Each asset and broker's "Rendimento ou Perda" is its
sales result in reais (average cost and sale both at the day's rate, as the
transaction stores them) plus its dividends grossed up from the net amount the
user records, with the 30% US withholding as foreign tax paid, credited up to
15% of the dividend. A loss offsets other items in the year and carries to the
next ones, so every year since 2024 is assessed; dividends are read from 2024
for that. Before 2024 a sale abroad was a capital gain (GCAP), which is a
pendency. The yearly rule is `FOREIGN_RULES` in `rules.py`, versions starting
on 1 January. Buying and selling the
same asset on the same day at the same broker is assessed as a common operation
and flagged, since day trade is not among what is traded here.

Rules are a catalogue in code (`income_tax/rules.py`): each version has the
period it is valid for, its legal source and the date it was checked. A sale is
assessed by the rule valid on its date; a period with no rule is a pendency, not
an exemption; a version starts and ends on the first day of a month, and
`validate_catalogue` refuses overlaps and mid-month changes. The due date is the
last bank business day of the following month, computed in
`income_tax/calendar.py` and presented as something to confirm in Sicalc, which
also computes fines and interest.

Money is `Decimal` from the transaction to the response, and the API serializes
it as a string with two decimals.

### The declaration's forms

The same response carries the forms of the IRPF program, field by field, in
`income_tax/declaration.py`, because the program imports no file from a third
party: the declaration is filled by copying from here. Each tab of the screen
after DARF is one form, with the fields in the program's order and a copy
button on each.

- **Bens e Direitos**: one item per asset and broker held on either 31/12 — or
  bought and sold within the year, with both values zero — valued at **cost** — the broker's quantity times the taxpayer's average cost — with
  group, code, country, the CNPJ the form asks for (issuer, fund, or custodian for
  fixed income) and a discrimination. A missing CNPJ is left empty and said, never
  replaced by the broker's. Pension is left out and said. An item abroad, from
  2024, also carries the "Aplicação Financeira (R$)" box — "Rendimento ou
  Perda" and "Imposto pago no exterior" — zeroed when the year had no income,
  and its discrimination states the cost in dollars and the average rate.
- **Rendimentos Isentos**: code 20 (stock gains in months up to R$ 20,000), 05
  (crypto up to R$ 35,000), 09 dividends and 99 FII/Fiagro income per payer, 12
  for CRI/CRA/LCA coupons.
- **Tributação Exclusiva**: code 10 JCP per company, and 06 for coupons of taxed
  fixed income. Dividend and JCP are told apart by `portfolio.dividend.kind`,
  which the user sets when recording the dividend.
- **Renda Variável** (common operations, and FII/Fiagro): each month's fields,
  with the result net of the exempt gain and the DARF payments split between the
  two regimes a 6015 DARF joins.
- **Ganhos de Capital**: the crypto sales of taxed months, as GCAP operations.
- **Aplicações no Exterior**: where each item's box comes from (sales,
  dividends received and grossed up, US withholding) and the year's summary —
  base, loss carried, 15%, credit — which the program recomputes and is shown to
  check, not to type.
- **Imposto Pago/Retido**: the withheld tax left at the end of the year.

Where a code is uncertain for an asset — a fund abroad, a fund without
come-cotas, an incentivized debenture — the item carries a note saying what to
check.

## Laboratory backtests

A theoretical portfolio is an allocation nobody bought, and the flow around it
is deliberately in two halves:

```text
carteira teórica (nome, pesos, regime)
  -> theoretical-portfolio service
  -> lab.theoretical_portfolio + lab.theoretical_position   (persisted)

alocação + janela + regime
  -> backtest service
  -> preços: cotações persistidas, provedor quando não houver, série de mercado
  -> motor de simulação (aportes, rebalanceamento)
  -> calculate_returns_analysis
  -> resultado devolvido à tela                             (nada persistido)
```

Only the parameter is stored. The return curve, the simulated patrimony and the
analysis are derived from quotes and series already in the database and are
cheap to recompute, so persisting them would create a second truth to invalidate
every time a new quote arrived — the same reason a fund profile is never
persisted.

`POST /lab/backtest` takes the whole allocation in the request body rather than
the id of a saved portfolio. That is what lets the screen simulate a draft
nobody saved — editing a weight and running again should not require writing a
row — and it is what makes `POST /lab/backtest/comparison` serve both the
variations panel and the portfolio comparator: varying one parameter of one
portfolio and comparing two different portfolios are the same reading. The price
series are fetched once for the union of every run's lines, so the second run
costs almost nothing.

Prices come from three places, and which one a line uses is what the line *is*.
A registered asset is read from `market_data.quote` through the persisted quote
reader, and an asset with no ingested history falls back to the provider, so a
ticker chosen from the catalogue can be simulated before it has ever been
ingested. The price measured is the **adjusted close**, which already carries
splits and distributions — there is no per-share dividend history to reconstruct
from. A line with no asset is either a market-data series read as a level, or a
series read as a daily rate through `calculate_fixed_income_price`, which is the
same arithmetic the registered fixed income uses.

The window is not the window that was asked for. It starts on the first day every
line has a price and ends on the day the first line stops having one; both bounds
are reported, along with the line that set the start. Weights are normalized at
run time rather than trusted to sum to 100, so a portfolio that lost a line to a
de-registered asset keeps the proportion between the lines that remain.

`lab` is its own module and its own schema. A theoretical portfolio belongs to a
user and has no transactions, no positions and no consolidation, which is why it
does not live under `portfolio`. It reads quotes and series through injected
market-data read services rather than another module's repositories.

`calculate_returns_analysis` moved from `portfolio/domain/asset_analysis.py` to
`app/lib/finance/analysis.py` for this: it is a pure function over a return
series that knows no entity, and the real portfolio and the theoretical one ask
it the same question. A second copy would put two disagreeing Sharpe ratios on
two screens.

## AI features and their artifacts

An AI feature is a registered capability, and what it answers is kept:

```text
GET /ai/asset_description_draft?asset_id=42
  -> read the feature, its active prompt version, and the artifact stored
     for (feature, prompt version, input)
  -> current?  answer with it, and stop            (no provider call)
  -> otherwise: assemble the generation context from the application's own
                read services
                render the active prompt version against that context
                call the provider with the feature's schema enforced
                validate the answer, and drop what it could not have known
  -> persist the artifact
```

Three surfaces reach that flow, and only one of them is written per feature.
`POST /ai/feature/{key}/run` generates and replaces what was stored — it is the
refresh, for the admin and for the card — and it validates its body against the
input model the handler declares, which is also what lets the admin build a run
form for a feature nobody wrote a screen for. `run_ai_feature` is the single
task the beat schedule and any manual dispatch go through; with no input it asks
the handler which inputs to refresh, so a feature becomes schedulable by
answering that question and taking a line in the schedule. The product route is
the third, and it never regenerates on its own.

**The prompt version is part of an artifact's identity.** The stored answer is
keyed by feature, prompt version and input, so activating a new version retires
what the previous one answered without anything having to invalidate it, and the
older answers stay in place to be read against the new ones. The first version of
this module keyed on the input alone, and a deploy that changed a prompt went on
serving the old answer for a week.

**Numbers come from the application; prose comes from the model.** Returns,
volatility and drawdown are measured from persisted quotes and handed to the
prompt already written. A figure that could not be measured is stated as
unmeasured, because a model asked to describe a return will produce a plausible
one whether or not it was given it.

**Nothing is cached in Redis.** The artifact table *is* the cache: a read is a
select by identity, and putting a cache in front of it would be caching a cache
and would owe an invalidation to keep honest — the same reason a consolidated
read has none. Whether an artifact is current is one comparison, because a
manually-refreshed feature stores no expiry rather than a distant one.

### The provider stack

Every call goes through three layers, each of which is a provider:

```text
recording      writes the run — tokens, cost, latency — and traces it
  fallback     walks the chain when a provider could not answer
    OpenAI
    Anthropic
```

Recording sits at the provider boundary rather than inside a feature's service,
so nothing reaches a model without leaving a row behind and no later caller has
to remember to instrument itself. That is also why the research extraction, which
is not a registered feature, appears on the usage screen. The spend ceiling is
checked in the same layer and before the call, where refusing still saves money.

The chain moves on when a provider *could not* answer — timed out, unreachable,
rate limited, out of funds — and never when it answered badly: a response that
fails its schema is a prompt defect, and a second model reproduces it at twice
the price. The model named by the prompt version decides which link answers
first; a request that falls through asks the next link for its own model, since
handing `gpt-4o` to another provider would fail for a reason unrelated to the
first failure.

Tracing is optional infrastructure on the same terms as the cache: an unreachable
sink makes a call untraced, never failed. Prompts are managed in this application
and traced elsewhere — putting prompt management in both places would be two
sources of truth for the same text.

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

The seven persistence operations have distinct entrypoints and one generic
execution tracker:

```text
quote page/task         -> quote ingestion service         -> quote history
series page/task        -> series ingestion service        -> market-data series history
USD/BRL page/task       -> USD/BRL ingestion service       -> USD/BRL history
fund registry page/task -> fund registry ingestion service -> fund registry tables
ETF registry page/task  -> ETF registry ingestion service  -> ETF registry tables, ETF links
ETF holdings page/task  -> ETF holdings ingestion service  -> ETF holding reports
share value page/task   -> share-value ingestion service   -> quote history (source 'cvm')
                              |
                              -> generic execution and attempt records
```

Series metadata and observations are stored in two different tables:
`market_data_series` identifies and types the series, while
`market_data_series_history` stores its observations. USD/BRL observations are
stored independently in `usd_brl_history`. Ingestion persists only observations
returned by the provider; calendar expansion and missing-date conversion belong
to read/domain flows.

Each series has one source, chosen by id in the provider adapter: CDI and IPCA
from the central bank, IFIX from B3's own daily tables, the MSCI indexes (World,
ACWI, EM, USA, ACWI ex-USA) from MSCI's end-of-day service, and the rest from
the quote provider. The MSCI series are net total return in USD and carry
MSCI's index code as their symbol; that service is undocumented, refuses dates
before 1997, and answers a bad request with HTTP 200 and the error in the body,
which the client turns into a failed attempt. Gold also comes from the quote
provider, but unlike the older provider series it is not filled forward over
days without a close. A series with no stored
observation is read whole even by the scheduled incremental run, so registering
one is enough for the next night to fill it.

### Market readings

`/market_data/readings/world` is a read computed on request from stored
history: the exchange rate (from the real on, July 1994 — earlier rows are
unscaled cruzeiros), bitcoin's quotes, gold, the CDI and IPCA, the MSCI indexes, and
the Ibovespa restated in dollars through the exchange rate of each day.
`/market_data/readings/etfs` reads the reference ETFs the same way, on the
adjusted close and with only the last year of history, for a sparkline. They
are priced by `ingest_quotes_for_reference_etfs`, part of the quotes routine:
it selects the ETFs and chains into `ingest_quotes`, asking the whole history
for one with no quote yet — an incremental run asks an empty asset for a week,
and a held asset gets its history when it is bought, which a reference ETF
never is.

`MarketReadingService` reduces each to weekly closes and the pure functions in
`market_data/domain/market_reading.py` measure returns, the 40-week moving
average, the drawdown from the peak and percentiles against the series' own
history, plus two index ratios and the real interest rate. Nothing is persisted
or cached; the answer carries weekly points for five years and monthly before
that, so the screen never downloads decades of daily closes. The frontend keeps
it out of the persisted query cache (`meta: { persist: false }`): a few hundred
kilobytes recomputed daily would otherwise evict the portfolio's warm start. The Mundo tab of
the market overview (`frontend/src/pages/market/overview/world/`) draws it, and
each card opens what it reads: an index or the CDI at `/market/series/:id`
(the CDI drawn per year, on session days only), bitcoin at its asset page, and
the dollar at `/market/usd-brl`, since the exchange rate is not a series.

Portfolio position consolidation reads persisted quotes only. Scheduled quote
ingestion runs before portfolio consolidation; missing quote history is an
explicit failure and never triggers a provider call inside the portfolio write
transaction.

### Funds priced from regulator filings

A fund sold outside any exchange — a FIDC bought through a broker, a pension
fund — has no ticker and no provider quote. It is priced from the share value it
files with the regulator (CVM open data), which is read directly because the
provider that republishes it lags by a month, and a month is the whole signal of
a monthly series.

```text
weekly (Tue 09:00) + manual  "Cadastro de fundos"
  ingest_fund_registry -> FundRegistryIngestionService
    -> CvmClient: registro_fundo_classe.zip, extrato_fi.csv (conditional GET, temp file)
    -> asset.fund_registry / _class / _subclass            (one transaction per file)

purchase "Buscar fundo por CNPJ" + admin "Ativos"
  -> GET /market_data/fund_registry, /class/{id}, /class/{id}/series
  -> POST /market_data/asset/fund                         (register or reuse an FI/PREV asset)
admin "Ativos"
  -> PUT /market_data/asset/fund/{id}/series               (confirm a legacy asset's series)
  -> PUT /market_data/asset/fund/{id}/series-aliases

daily (09:15) + manual  "Valores de cota"
  ingest_fund_share_values_for_held_funds  (portfolio: which funds, since which purchase)
    -> ingest_fund_share_values -> FundShareValueIngestionService
         -> plan files per fund from coverage; read each file once for all funds
         -> quotes + coverage per fund, in one transaction
         -> recalculate_positions_for_assets   (by name, when stored values changed)
```

The registry lives in the database, not in a cache, because assets point at it.
A registry row is not an asset: `asset.fund` gains a link to the **priced unit**
— the class, a subclass, or a FIDC series — and the unit is unique, enforced by
the database as well as the service.

Any authenticated user can search the registry and confirm a fund while
entering a purchase. `components/fund-registry/FundRegistrationDrawer.tsx`
is shared with the admin: it carries the typed CNPJ, asks for the priced unit,
and returns the selected asset to `AssetSelector`. Registering an already
existing unit returns its asset id; a class row lock serializes concurrent
confirmations. Tickerless funds are shown by name and their purchase price is
entered by the user. Registry ingestion, legacy series assignment and alias
editing remain admin operations.

Nothing about the regulator passes the adapter: `app/infra/integrations/cvm_client.py`
knows paths, packaging and listings, and
`app/modules/market_data/adapters/fund_filings.py` knows columns, spellings and
the three historical layouts. Files are streamed to temporary disk, read row by
row off the event loop, and deleted — there is no bucket and no stored body.

Skipping work is decided by **coverage**, never by a validator alone.
`market_data.source_file` holds the validators and content digest of the last
fully processed version of each file; `market_data.fund_share_value_coverage`
records that a version was applied to one fund, for its selection version and
from its purchase date, and commits with that fund's quotes. A `304` skips a
file only for the funds already covered by that version. A retrodated purchase,
a new series alias (which bumps the fund's selection version) or a failed
earlier attempt makes the same file due again. A failure covers nobody and
spares the other funds.

Terms also depend on the registry they were applied to:
`source_file.applied_registry_version` stores that registry content digest.
An unchanged terms file is downloaded again after the registry changes or
recovers from a failed first ingestion, so newly stored classes receive their
fees and conditions.

Applying a changed share-value file reconciles the source's quotes within
that file's date range, including withdrawn observations and moved dates.
Deletions, replacement values and coverage commit together. A withdrawn seed
starts the backwards search again. A malformed header or numeric value fails
the file rather than being mistaken for an empty snapshot.

History starts at each fund's first purchase, plus the **seed**: the last value
filed on or before it, found by reading earlier files one at a time down to the
earliest the source lists. Consolidation reads that seed too — for every asset
priced from persisted quotes it prepends the last quote on or before the first
trade, so a purchase on a day without a quote is priced from the one before it.

Routine runs re-read the files that may still change: those overlapping the
last 35 days of stored values. The **revision sweep** — the same daily run from
Tuesday on, until each fund succeeds, tracked in `market_data.ingestion_checkpoint`
by asset id, selection version and first purchase date because execution
history lasts two days — also re-reads daily months M−2 to
M−11 and every FIDC month of the fund's history. A changed value dispatches a
full recalculation of every position of that asset, because the routine
consolidation only rebuilds a 15-day overlap. Withdrawals also trigger that
recalculation. A manual subset or empty execution cannot complete another
fund's revision; a failed fund stays due.

FIDC series are identified by internal id, with confirmed label aliases per date
interval; an alias cannot mean two series on the same date (an `EXCLUDE`
constraint). A FIDC requires an explicitly confirmed series even when it has
only one with shares. The registration form preselects that sole candidate,
and confirmation persists its identity and first alias. A legacy asset without
a series fails before checking coverage until the admin confirms its series;
its asset id and transactions stay unchanged. A label nobody confirmed or two
different values filed for one series on one date fail that fund explicitly.

### Operations: what runs, when, and how it ended

Everything that brings data in or keeps it consistent is a **routine** in
`app/modules/operations/domain/routines.py`, and the admin's integrations
dashboard (`/admin/integrations`) is where they are watched and started.

```text
beat_schedule (entrypoints/worker/scheduler.py)  --the only place times live
   | translated at the edge (composition/operations.py) into CronSpec
   v
GET /operations/dashboard -> OperationsReadService
   schedules  : description, frequency, next runs, previous due time
   last run   : operations.task_run (+ what it sent, by parent task id)
              + the latest ingestion execution, for an ingestion routine
   health     : ok / warning / failing / running / missed / never / on demand
GET  /operations/runs                 the run record, filtered
POST /operations/routines/{key}/run   sends what the schedule sends
```

The run record is written by `celery_async_task`, around every task, into
`operations.task_run`. A task does nothing to be recorded, which is the point:
the consolidation, the dividend sweep and the history cleanup used to leave a
log line and nothing else. Who sent a run is read off the message — a task sent
from inside another carries it as parent, the scheduler's messages carry a
`trigger` header that `celery_app` stamps on every entry, and anything else
came from a screen. Recording never decides a task's fate: a record that cannot
be written is logged and the task runs anyway. The record is kept 45 days, so a
weekly or monthly routine is still on the dashboard after its ingestion
execution — kept two days — is gone.

A routine is started by hand the way it runs: an ingestion through its own
route, which opens its execution first; a plain task by the operations route,
which sends exactly the tasks its schedule entries send; a routine that shows
a diff before writing (the asset catalogue, the CVM company registry, the fund
links) only on its own screen.

Two tests keep the catalog whole: every scheduler entry and every registered
task belongs to exactly one routine. Operations is a leaf module — no other
module imports it (`.importlinter`) — and reads the others only through the
unit of work.

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

## Domain language

The canonical glossary shared by backend, frontend, and documentation is
`docs/domain.md`.

## Open decisions

- Eligibility and recency rules used to select active positions for scheduled
  quote ingestion.
- Which downstream calculations and caches must run after quote ingestion.
- Whether manual ingestion has different authorization or selection rules from
  scheduled ingestion.
