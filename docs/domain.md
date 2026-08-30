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
| Wealth tier | Patente | Title a portfolio earns by reaching a patrimony threshold, such as Pedinte or Imperador. The ladder is data: its rungs, names, thresholds, and artwork are edited through an administrative CRUD, so nothing may assume a fixed number of tiers or a fixed title. A tier is measured against the peak portfolio value and therefore reached once and never lost — a portfolio that falls back keeps the title. What remains to reach the next tier is measured against the current portfolio value instead, since that is a question about today: a portfolio that fell back keeps its title and sees the real distance ahead. Thresholds are held in BRL, independent of the currency a screen displays. |
| Tier artwork | Arte da patente | Illustration belonging to a wealth tier, stored as SVG source on the tier itself. It is content, not an asset path: there is no bucket, file store, or static route behind it. |

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

## Processing terms

| Canonical term | pt-BR | Definition |
| --- | --- | --- |
| Scheduled job | Job agendado | Time-based instruction that dispatches a background task. |
| Background task | Tarefa em segundo plano | Asynchronous entrypoint used for quote ingestion, position recalculation, return consolidation, provider synchronization, or cache warming. |
| Cache | Cache | Derived data stored temporarily to accelerate repeated reads; it is not the source of truth for portfolio or market data. |
