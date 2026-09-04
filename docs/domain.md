# Domain glossary

This is the canonical language for My Stonks. It is based on the domain currently
implemented by the backend and consumed by the frontend.

Use the English term in code and API contracts. Use the pt-BR term in product
copy. A translation is not a separate domain concept. Infrastructure names such
as Brapi, Celery, Redis, SQLAlchemy, and OpenAI are not domain terms.

## Core concepts

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| User | Usuário | Person with access to the application. A user may own portfolios and may have administrative privileges. |
| Portfolio | Carteira | User-owned collection that groups transactions, positions, dividends, categories, returns, settings, and rebalancing targets. |
| Asset | Ativo | Investable instrument registered in the application and identified by an internal ID. It may also have a ticker, exchange, type, and type-specific data. |
| Ticker | Código do ativo | Market or provider identifier used to request and display an asset, such as `PETR4` or `BTC`. It is not the application's primary identity for the asset. |
| Asset class | Classe de ativo | Broad investment grouping to which an asset type belongs, such as fixed income, variable income, pension, or cryptoassets. |
| Asset type | Tipo de ativo | Specific classification that determines an asset's behavior, provider strategy, calculations, and optional subtype data. |
| Exchange | Bolsa ou mercado | Trading venue associated with an asset, identified by a code such as `B3`, `NASDAQ`, or `NYSE`. |
| Currency | Moeda | Monetary unit used to express prices and amounts. The application currently works primarily with BRL and USD. |
| Broker | Corretora | Institution through which a portfolio transaction is recorded. A broker has a base currency used when interpreting transaction and dividend inputs. |
| Market-data provider | Provedor de dados de mercado | External source used to obtain quotes, indexes, exchange rates, or income data. Provider-specific payloads are translated before entering the domain. |

## Asset catalog

The canonical code identifier for an asset type is its uppercase key.

| Identifier | pt-BR | Meaning |
| --- | --- | --- |
| `ETF` | ETF | Exchange-traded fund. |
| `FII` | Fundo imobiliário | Brazilian real-estate investment fund. |
| `TREASURY` | Tesouro Direto | Brazilian federal government bond. |
| `STOCK` | Ação | Equity issued by a company. |
| `BDR` | BDR | Brazilian depositary receipt representing a foreign security. |
| `PREV` | Previdência | Pension investment fund. |
| `FI` | Fundo de investimento | Investment fund that is not modeled as ETF, FII, or pension. |
| `CDB` | CDB | Bank deposit certificate. |
| `DEB` | Debênture | Corporate debt security. |
| `CRI` | CRI | Real-estate receivables certificate. |
| `CRA` | CRA | Agribusiness receivables certificate. |
| `REIT` | REIT | Foreign real-estate investment trust. |
| `CRIPTO` | Criptoativo | Cryptoasset. |
| `LCA` | LCA | Agribusiness credit note. |

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Stock details | Dados da ação | Asset-specific country, sector, and industry data. Also used for BDR behavior where applicable. |
| Investment-fund details | Dados do fundo | Asset-specific legal and ANBIMA identifiers and category. |
| Fixed-income details | Dados de renda fixa | Maturity, rate, rate convention, and reference index associated with a fixed-income asset. |
| Fixed-income type | Tipo de rentabilidade da renda fixa | Rate convention: fixed rate, index plus a spread, or percentage of an index. |
| Treasury-bond details | Dados do título público | Maturity, rate, and Treasury bond type associated with a Treasury asset. |
| FII type | Tipo de FII | High-level FII strategy, such as brick, paper, hybrid, or fund of funds. |
| FII segment | Segmento de FII | More specific economic or property segment within an FII type. |
| FII profile | Perfil do FII | Everything an FII publishes about itself: its management, its indicators and their history, the payments it has made, its latest monthly report, and the composition of what it holds together with the history of that composition and of its properties. Read on demand from a market-data provider and never persisted, since a fund republishes it on its own schedule and the application keeps no history of it. Each part is read independently: one provider route failing costs that part alone. |
| FII indicators | Indicadores do FII | The numbers an FII reports as of its last published report: price, NAV per share, price to NAV, dividend yields, monthly return, equity, total assets, shares outstanding, shareholders, and segment. Every one of them is optional, and an indicator a provider does not publish is absent rather than zero — an unknown P/VP and a P/VP of zero are different statements. |
| FII management | Administração do FII | Who runs a fund and under which mandate: its registration, the mandate it is chartered to pursue, whether management is active or fixed by the charter, and the administrator. Published beside the indicators and not a measurement. |
| FII monthly report | Informe mensal do FII | The report an administrator files with the regulator every month, stating what the fund's equity is made of in reais — properties, CRI, LCI, shares in other funds, receivables, cash — along with the administration fee it charged, its patrimonial return, and its liabilities. The indicators say how much a fund is worth; the monthly report says of what. |
| FII composition | Composição do FII | What a fund held at the end of a quarter, item by item: its properties, its financial assets such as CRI, its shares in other funds, its land and its rights, plus the allocation by asset class. Filed quarterly and published months later, so it always carries the quarter it refers to — it is the most recent picture available, not the current one. A property is counted and described but carries no declared value, so an allocation summed over classes is a sum of the paper and not of the fund. |
| FII property | Imóvel do FII | One building a fund owns, as described in the quarterly filing: area, units, vacancy, delinquency, and how much of the fund's revenue it answers for. A fund still building or selling also reports construction progress and cost, and how much is leased or sold. |
| Vacancy | Vacância | How much of a fund's area is unoccupied. Consolidated vacancy weighs each property by its area; average vacancy is the plain average across properties. Both are published and they answer different questions, so neither stands for the other. Held as a ratio. |
| NAV per share | Valor patrimonial por cota | A fund's equity divided by its outstanding shares. |
| Price to NAV | P/VP | Share price divided by NAV per share, held as the multiple a provider publishes and never recomputed. 1.018 means the share trades 1.8% above the fund's own valuation. |
| Dividend yield | Dividend yield | Dividends over a period relative to the current share price. Held as a ratio: 0.12381 is a yield of 12.381%. Percentages are a presentation choice. |
| Dividend event type | Tipo de provento | What a fund called a payment — an ordinary distribution or an amortization of capital. Amortization returns principal and is not income, so the two are kept apart rather than summed. |
| Market catalogue | Catálogo de mercado | The tradable universe of one asset class as a market-data provider publishes it: ticker, name, last price, daily change, volume, market cap, and logo. It is a read of the provider, held in cache and never persisted as history — the application's own registry of assets is what persists. |
| Asset registry sync | Sincronização do cadastro | The manual merge between the asset registry and a market catalogue. A ticker in both takes the provider's name and logo; a ticker only in the catalogue becomes a new asset; a ticker only in the registry stays untouched, because instruments without a public quote — fixed income, Treasury, pension — are in no catalogue and carry portfolio history. |
| Asset logo | Logo do ativo | The URL of an asset's logo, as published by a market-data provider and stored with the asset. The image itself is never stored. |
| Investment-fund kind | Tipo de fundo | The family an investment fund belongs to: `fiagro`, `fiinfra`, `fidc`, `fip`, `fif`. It decides what the fund can even publish — a FIDC files monthly share values and no daily ones, a FIP files neither — and it is what separates these funds from a FII or an ETF. It is stated by the provider and never inferred from a ticker: a code ending in 11 says nothing about which kind a fund is. |
| Investment-fund profile | Perfil do fundo | Everything a fund that is neither a real-estate fund nor an ETF publishes about itself: its registration, its indicators, the share value it files over time, the payments it has made, the monthly filing the regulator asks of some of them, and the quarterly filing of what it holds. Read on demand from a market-data provider and never persisted, on the same terms as the FII profile. Each part is read independently: one provider route failing costs that part alone. Kept apart from the FII profile because the funds are: one is read through buildings and vacancy, the other through share value, equity and the credit it carries. |
| Investment-fund indicators | Indicadores do fundo | The figures a fund reports as of its last filing: price, NAV per share, price to NAV, equity, total assets, shareholders, shares outstanding, the money applied and redeemed on the reference day, its monthly return, its patrimonial monthly return and its monthly dividend yield. Every one is optional and an absent one is nothing rather than zero — these routes leave most of them blank for most kinds of fund. |
| Patrimonial return | Retorno patrimonial | What a fund's equity earned over a period, before what it distributed. Distinct from the return to a holder, which the distribution is part of: a fund that paid heavily separates the two. Held as a ratio. |
| Share-value filing | Informe do valor da cota | One filing of a fund's NAV per share, with the equity, the total assets, the shareholders and the day's applications and redemptions behind it. It is the fund's own accounting and not its market price — a share that has not traded in a week still has one filed every day. An FI or FIF files daily and a FIDC monthly, by class or series, so a date alone does not identify one. |
| Fund class or series | Classe ou série | Which class of a fund a filing is about, where a fund issues more than one — a FIDC has a senior and a subordinated class, and they are worth different amounts. Two classes filing on one date are two facts, and a variation is only ever read within one class. |
| Regulatory profile | Perfil mensal | The monthly filing an administrator makes with the regulator: who holds the fund, how much of it the largest holder answers for, the risk model the fund declares and the figures that model produced, and its exposure to private credit. Only the funds the regulator asks it of file one, so an absent profile is a fact about the fund's kind. Its percentages arrive already scaled — 100 is 100% — unlike the yields and returns elsewhere, which are ratios. |
| Fund portfolio filing | Carteira do fundo | What a fund held at the end of a quarter, line by line, in six groups: public bonds, shares in other funds, credit assets, listed securities, receivables and payables. Published months after the quarter it refers to, so it always carries that quarter. The group travels with each line because the last two are a claim and an obligation rather than things owned; the filing's own market value is not the sum of the groups, since receivables add to it and payables subtract. |
| Fund holding | Posição do fundo | One line of that filing. A position a fund chose not to name arrives flagged as confidential and already aggregated, which is a decision the fund made and not a gap in the data. |
| Stock profile | Perfil da ação | Everything a listed company publishes about itself, together with what the market pays for it: the business behind the ticker, the band the year drew around its price, the multiples, the fundamentals, its payment history, and the statements it files. Read on demand from a market-data provider and never persisted, on the same terms as the FII and investment-fund profiles. Each part is read independently: one provider route failing costs that part alone. Kept apart from the fund profiles because a company is not a fund — what a fund publishes of itself is a share value and a portfolio, and what a company publishes is a result, a balance and a cash flow. |
| Stock statistics | Indicadores da ação | What the market pays for the company: market cap and enterprise value, the price-to-earnings and price-to-book multiples, book value and earnings per share, beta, the dividend yield, and the shares issued and in circulation. Carried as the provider publishes them and never recomputed from price and earnings, which would produce a third number disagreeing with the two already on screen. Every proportion is a ratio: 0.08 is 8%. |
| Stock fundamentals | Fundamentos da ação | How the business did before the market had an opinion: revenue, gross profit and EBITDA, cash and debt, the liquidity and leverage ratios, return on equity and on assets, the margins, and growth stated both for a quarter against the same quarter a year earlier and for a year against the year before. The profit margin is read from here alone, though a second route also publishes it, so the two cannot drift apart. |
| Financial statement | Demonstrativo | One statement a company files — its income statement, balance sheet, cash flow, or statement of value added — as a series of periods, oldest first. Each period carries only the lines that company actually reported. The lines are a mapping rather than fields because filers disagree on which lines exist: the provider answers with every line any Brazilian filer might report, and a bank fills a different set than an industrial company does, with few in common. A line a company did not file is absent, never zero. |
| Statement line | Linha do demonstrativo | One reported figure within a statement period, named by the provider's line name. Which lines reach a screen, and in what order, is a presentation decision and not part of the filing: the order a provider answers in is not the order a statement is read in. |
| Cash dividend | Provento em dinheiro | A payment in money per share, labelled as an ordinary dividend or as interest on own capital. The label matters and is never normalized away: interest on own capital is taxed at source and a dividend is not, so the two cannot be added up by anyone meaning income received. The date the share last carried the right is distinct from the payment date, which is regularly in the future because a company announces months ahead. |
| Share dividend | Provento em ações | A payment in shares — a bonus issue or a split. It has a proportion and no amount, and no payment date, which is why it is a separate concept from a cash dividend rather than one with half its fields empty. It puts no money in a holder's pocket, so it never enters a sum of income. |
| ETF segment | Segmento de ETF | Classification of an ETF by exposure, such as Brazilian equities, international equities, fixed income, or commodities. |

## Market data, quotes, and prices

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Market data series | Série de dados de mercado | Registered and explicitly typed time series used as a market indicator, fixed-income indexer, or performance reference. Its metadata is stored separately from its history. Examples include CDI, IPCA, IFIX, S&P 500, IBOVESPA, and NASDAQ. The USD/BRL exchange rate is not one of them. |
| Market data series history | Histórico da série de dados de mercado | Persisted chronological observations belonging to one market-data series. OHLC fields may be used by market indexes; scalar indicators primarily use the close value. |
| Market index | Índice de mercado | A market-data series of the `market_index` type, such as IFIX, S&P 500, IBOVESPA, or NASDAQ. It is a type, never a synonym for series: CDI is an `interest_rate` and IPCA an `inflation_rate`, so neither is an index. Do not name code, routes, or schemas `index` when they mean a series — there is one route family, `/market_data/series`. |
| Benchmark | Referência de desempenho | A market-data series selected to compare the performance of a portfolio, category, or asset. Benchmark is a role played by a series. |
| Quote | Cotação | Complete structured market-data observation for one asset and date. In this application it may contain open, high, low, close, adjusted close, volume, currency, and source. A quote does not imply bid or ask data. |
| Quote history | Histórico de cotações | Chronological collection of quotes for an asset. It may be returned on demand by a provider or persisted in the `market_data.quote` table. |
| Price | Preço | A single monetary value. Use it for a value inside a quote, a transaction unit price, an execution price, or a calculated monetary value. It never represents a complete market-data observation. |
| Prices | Preços | Collection or time series containing only scalar price values, such as closing prices. A collection of structured observations is `quotes`, not `prices`. |
| Close price | Preço de fechamento | Final price in a market period and the primary price used by portfolio position calculations. |
| Adjusted close | Fechamento ajustado | Close price adjusted by the data source for applicable corporate actions. |
| OHLCV | OHLCV | Set of open, high, low, close, and traded volume fields carried by a quote. It is not a separate domain entity. |
| Quote source | Fonte da cotação | Provider identifier retained with persisted quotes and ingestion attempts. |
| Exchange rate | Taxa de câmbio | Conversion rate between currencies. It is not a market-data series: the canonical USD/BRL rate has its own history table, and every service that converts currency reads it from there. Each observation stores both directions — `usd_brl`, the BRL value of one USD, and `brl_usd`, its inverse — so consumers convert by multiplying and never divide. |

### Naming rules

Use `Quote` for the complete structured market-data object and `price` only for
a scalar monetary value. Use `quotes` for a collection of `Quote` objects.

Examples:

- `Quote`, `QuoteRepository`, `QuoteService`, and `get_quotes()`;
- `quote.close`, `transaction.price`, and `position.average_price`;
- `closing_prices` and `list[Decimal]` for scalar series.

Do not use:

- `Price` or `MarketPrice` for a complete quote object;
- `PriceResponse` when a response contains complete quote objects;
- `prices` for a collection whose items contain a date plus OHLCV or provider
  metadata.

## Data ingestion

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Data ingestion | Importação de dados | Tracked application process that fetches and persists one supported market-data dataset. The supported types are quote, market-data series, and USD/BRL. |
| Quote ingestion | Importação de cotações | Application process that selects assets, fetches quotes from a provider, normalizes them, and upserts them into quote history. |
| Incremental ingestion | Importação incremental | Data ingestion that starts from the latest persisted observation with a bounded overlap. Quote scheduling selects recently held supported assets. |
| Full-history ingestion | Importação completa | Data ingestion that requests the maximum history available for its explicitly selected items. |
| Ingestion execution | Execução da importação | Generic tracked run discriminated by ingestion type. It records trigger, mode, lifecycle timestamps, item totals, result, and task identifier. |
| Ingestion attempt | Tentativa de importação | Per-item work record within an execution. It records opaque item ID and label, source, parameters, status, row counts, and error. |
| Manual trigger | Acionamento manual | Ingestion execution requested by an authorized user. |
| Scheduled trigger | Acionamento agendado | Ingestion execution started by the scheduler. |
| Execution status | Status da execução | Lifecycle state: queued, running, success, partial success, failure, or aborted. |
| Aborted execution | Execução abortada | Ingestion execution stopped on purpose before reaching an outcome. It closes the attempts left open and releases the one-execution-per-type slot at once; the runner stops between items, so the item already in flight still finishes. |

## Portfolio activity and holdings

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Transaction | Operação | Recorded purchase or sale of an asset in a portfolio through a broker. It has date, signed quantity, unit price, and BRL/USD representations. |
| Purchase | Compra | Transaction with positive quantity. |
| Sale | Venda | Transaction with negative quantity. |
| Corporate event | Evento corporativo | Asset event that changes historical quantities by a factor, such as split, reverse split, bonus, or conversion. |
| Dividend | Provento | Cash amount attributed to an asset and portfolio on a date, stored in BRL and USD representations. |
| Position | Posição | Daily derived snapshot of a portfolio's holding in one asset. It includes quantity, price, average price, invested amount, and returns in BRL and USD. |
| Current position | Posição atual | Most recent available position snapshot for an asset in a portfolio. |
| Active position | Posição ativa | Current position whose quantity is not zero. |
| Position recalculation | Recálculo de posição | Process that rebuilds an asset's daily positions from transactions, corporate events, quote close prices, exchange rates, and dividends. |
| Average price | Preço médio | Weighted acquisition price of the currently accumulated quantity. |
| Total invested | Total investido | Cumulative net transaction amount used by the position calculation. |
| Portfolio value | Patrimônio da carteira | Sum of quantity multiplied by current price across the selected portfolio positions on a date. |
| Contribution | Aporte | Transaction cash flow added to or removed from the portfolio, calculated from transaction quantity and unit price. |
| Peak portfolio value | Pico do patrimônio | Highest portfolio value ever reached, read from the portfolio's own value history rather than stored. It is what a wealth tier is earned against, and it is not what the distance to the next tier is measured from. |
| Wealth tier | Patente | Title a portfolio earns by reaching a patrimony threshold, such as Pedinte or Imperador. The ladder is fixed in code (`backend/app/modules/portfolio/domain/wealth_tier_ladder.py`): fifty rungs, from 0 to R$ 5.000.000, each paired with a scene drawn for it, so a rung is added by a commit and not by an admin screen — there is no CRUD and no table behind it. A tier is measured against the peak portfolio value and therefore reached once and never lost — a portfolio that falls back keeps the title. What remains to reach the next tier is measured against the current portfolio value instead, since that is a question about today. Thresholds are held in BRL, independent of the currency a screen displays. |
| Tier scene | Cenário da patente | The background scenery shown for a wealth tier on the Jornada do Herói screen. It is not stored: each scene is an image file versioned in the frontend repository (`frontend/src/assets/tiers`), bound to a tier by the rung's position on the ladder, counted from zero. Scenes ahead of the current tier are shown locked, as a silhouette with a `?`; scenes already earned can be revisited. |

## Organization and rebalancing

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Custom category | Categoria personalizada | Portfolio-owned grouping created by the user to organize assets. It has a name, color, optional benchmark, and target allocation. |
| Category assignment | Atribuição de categoria | Relationship that assigns an asset to a custom category and may store the asset's target percentage within that category. |
| Portfolio segment | Segmento da carteira | Named subset of a portfolio's positions defined by asset-type **ids** and, when the same type trades in more than one market, by which market. By id, never by `asset_type.short_name`: that column holds pt-BR product copy — `Ação`, `Tesouro`, `Cripto` — while the codes below are English, so matching the two works for the types whose label equals its code and silently fails for the rest. There are five: `fii`, `equity-br`, `equity-world`, `fixed-income`, and `crypto`. It is derived, not chosen: a position belongs to exactly one segment, or to none. Its return series is consolidated like any other scope, so reading one is a select; it was a read-side grouping computed per request until the return tables were unified. The application resolves it and returns it with the position, so no consumer re-derives the rule. Segments need not cover the portfolio: pension and investment funds belong to none, and a position outside every segment simply has no specialized screen. |
| Brazilian market | Mercado brasileiro | Which side of a segment an asset falls on, decided by its exchange: B3, or no exchange at all — how a Treasury bond, a bank note, and anything without a listing abroad is registered — is the Brazilian side; any other exchange is abroad. It is the same rule the market-data provider applies when it decides such an asset is quoted in BRL. |
| Portfolio slice | Recorte da carteira | A named subset of a portfolio's positions that a whole screen is about: a custom category or a portfolio segment. Only how the subset is chosen differs between the two; everything read about it — allocation, returns, risk, patrimony, dividends, trades, targets — is the same reading, which is why they share one screen and one vocabulary. |
| Target allocation | Alocação alvo | Desired percentage for a category within the portfolio or for an asset within its category. |
| Current allocation | Alocação atual | Percentage represented by the current value of a category or asset. |
| Rebalancing | Rebalanceamento | Comparison between current and target allocations, producing target values and positive or negative differences for categories and assets. A target belongs to a category, so a slice narrows *which categories* are compared and never shows half of one: hiding part of a category's assets would stop its own percentages from adding up. |
| Contribution simulation | Simulação de aporte | Distribution of a hypothetical contribution across categories and assets **by buying only**: no position is reduced, so a category already above its target allocation receives nothing. It answers where to direct new money to move the portfolio closer to its targets, not how to reach them exactly. Distinct from rebalancing, whose negative differences imply selling. |
| Portfolio configuration | Configuração da carteira | Named, portfolio-scoped feature setting with enabled state and optional configuration data. |

## Performance and risk

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Daily return | Retorno diário | Percentage performance for one day. Portfolio and category returns are value weighted; asset returns incorporate price variation and recorded dividends. |
| Accumulated return | Retorno acumulado | Compounded return from the beginning of the evaluated series through a date. |
| Twelve-month return | Retorno em 12 meses | Return over the trailing twelve-month period. |
| CAGR | Retorno anualizado | Compound annual growth rate calculated from the beginning of a return series. |
| Realized profit | Lucro realizado | Monetary gain or loss recognized by a sale relative to its acquisition cost. It is an amount, not a return percentage. |
| Return series | Série de retorno | Persisted daily, accumulated, and annualized performance of one part of a portfolio, one row per date. It is the same arithmetic at every altitude — each position weighs by what it was worth the day before — so all of them live in one table, `portfolio.return_series`, told apart by scope. |
| Return scope | Escopo do retorno | Which part of the portfolio a return series is about: the whole portfolio, a custom category, an asset type, or a portfolio segment. `scope` names the altitude and `scope_key` names which one of them, as text because the four keys are not the same kind of thing — a category id, an asset-type id, a segment code, and nothing at all for the portfolio itself, which uses the empty string. |
| Consolidation stamp | Carimbo de consolidação | When a portfolio's derived data was last rebuilt, and whether the run succeeded. One row per portfolio, overwritten each run: the screens ask whether a number is current, which is a question about the last run. `consolidated_at` is when the rebuild finished, which is not the date the numbers reach — that one is bounded by the last quote ingested. |
| Performance analysis | Análise de desempenho | Set of return metrics and comparisons against one or more benchmarks. |
| Risk analysis | Análise de risco | Set of risk metrics including volatility, Sharpe ratio, drawdown, semideviation, skewness, kurtosis, VaR, and CVaR. |
| Drawdown | Drawdown | Decline from a previous accumulated-value peak and its duration/recovery characteristics. |
| Alpha | Alfa | Difference between the evaluated CAGR and a benchmark CAGR. |
| Beta | Beta | Sensitivity estimate derived from correlation and relative volatility against a benchmark. |

## Tax reporting

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Fiscal year | Ano-calendário | Year used to select positions, transactions, income, and tax calculations. |
| Assets and rights report | Bens e direitos | Tax-report view of portfolio holdings at the end of the fiscal and previous years, grouped by asset and broker. |
| Gross sales | Vendas brutas | Total sale amount in a tax calculation period. |
| Accumulated loss | Prejuízo acumulado | Prior taxable loss carried forward in the tax calculation. |
| Tax due | Imposto devido | Tax calculated for a period after applying the rules for the applicable asset type. |
| DARF summary | Resumo de DARF | Monthly grouping of taxable results and tax due used to support Brazilian federal tax payment. |

## AI-generated content

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| AI feature | Funcionalidade de IA | Registered AI capability with a stable key and default artifact lifetime. |
| AI artifact | Artefato de IA | Persisted result generated for an AI feature and input, including summary, structured payload, model, generation time, and expiration time. |
| Asset overview and news | Visão geral e notícias do ativo | AI feature that generates a current overview and news payload for an asset ticker. |

## Research recommendations

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Research source | Fonte de research | The house that publishes a recommendation — BTG Pactual, XP Research. Identified by a slug derived from its name, so the same house typed two different ways stays one house. |
| Recommended portfolio | Carteira recomendada | One published edition of a house's recommended portfolio: its title, the month it refers to, the summary and the objective the report declares, and the assets it recommends with their weights. It belongs to the house and not to a user or a portfolio: the same edition is the same for everyone. |
| Reference date | Competência | The month a recommended portfolio speaks for, not the day the report was read. It is what tells two editions of the same carteira apart, and the date any later measurement of the recommendation has to start from. |
| Recommended position | Posição recomendada | One line of a recommended portfolio: a ticker, the weight it is given, and optionally the registered asset it points at, the target price, the rationale, and what the edition did with it. A line whose ticker is not in the catalogue keeps its ticker and no asset — dropping it would change the weight of the ones that stayed. |
| Recommendation change | Mudança da recomendação | What an edition did with a line compared to the previous one: entered, increased, reduced, unchanged, or exited. An absent change is the report saying nothing, which is different from it saying the position was kept. |
| Recommended portfolio draft | Leitura da carteira recomendada | The reading of a research PDF before anyone agreed with it: what the model extracted, plus, for each line, whether the catalogue carries that ticker, does not carry it, or carries it more than once. It is never persisted — it becomes a recommended portfolio only once a person confirms it. |

## Portfolio laboratory

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Theoretical portfolio | Carteira teórica | A named allocation a user builds in the laboratory: lines with weights, plus the contribution and rebalancing regime a simulation runs under. It belongs to a user and never to a portfolio — it has no transactions, no positions, and nothing about it is consolidated. What persists is the parameter; the return curve, the simulated patrimony and the analysis are never stored, since they are derived from quotes already held and cheap to recompute. |
| Theoretical position | Posição teórica | One line of a theoretical portfolio, and the three ways a line becomes a price: a registered **asset**, whose quotes price it; a **market-data series** alone, which is exposure to the index itself; or a series with a fixed-income type and a rate, which is synthetic fixed income. Exactly one of those holds for any line, and the database refuses the middle ground. |
| Synthetic fixed income | Renda fixa sintética | A line with no asset behind it, priced from a market-data series and a **fixed-income type** — 110% of CDI, IPCA + 6%, or a plain fixed rate. It is how the laboratory represents a CDB or a Treasury bond, instruments that carry no quote at all. The arithmetic is the one the registered fixed income already uses, so a synthetic CDB earns what the real one earned. |
| Backtest | Backtest | The simulation of a theoretical portfolio over past prices: an initial amount, periodic contributions and a rebalancing calendar, producing a daily return series, the accumulated patrimony, and the same performance and risk analysis a real portfolio gets. Computed on demand and never persisted. |
| Backtest window | Janela do backtest | The period a backtest could actually run. It starts on the first day **every** line has a price — before that the portfolio would not be the one that was asked for — and ends on the day the first line stops having one, since a delisted line carried forward would read as a stable holding. It reports which line set the start. |
| Contribution schedule | Regime de aportes | How much money enters the simulation and how often. Between two rebalancing dates a contribution **buys only**, filling the lines furthest below their target first — the same reading the glossary calls **contribution simulation**. |
| Rebalancing schedule | Regime de rebalanceamento | How often the simulation returns every line to its target weight. On a rebalancing date selling is allowed and tax is not modelled. `none` means contributions alone do the correcting. |
| Backtest variation | Variação do backtest | The same theoretical portfolio simulated again with one parameter changed — the contribution or the rebalancing frequency — so the results can be read side by side. It is the same reading as comparing two different theoretical portfolios, and it goes through the same route. |
| Preset allocation | Modelo de carteira | A ready-made allocation the laboratory offers as a starting point. Fixed in code like the wealth-tier ladder, so a model is added by a commit and not by an admin screen, and defined over market-data series only: a model made of tickers breaks the day an asset leaves the catalogue. |

## Processing terms

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Scheduled job | Job agendado | Time-based instruction that dispatches a background task. |
| Background task | Tarefa em segundo plano | Asynchronous entrypoint used for quote ingestion, position recalculation, return consolidation, provider synchronization, or cache warming. |
| Cache | Cache | Derived data stored temporarily to accelerate repeated reads; it is not the source of truth for portfolio or market data. |
