/**
 * Centralized backend route definitions.
 * Mirrors the FastAPI routers under `backend/app/modules/*`.
 *
 * Plain strings expose static endpoints. Functions build paths with parameters.
 * Use these constants in every `api.*` call to keep frontend and backend in sync.
 */

// ---------------------------------------------------------------------------
// Auth / Users
// ---------------------------------------------------------------------------
export const AUTH_ROUTES = {
  login: '/auth/jwt/login',
  register: '/auth/register',
} as const

export const USER_ROUTES = {
  list: '/users',
  me: '/users/me',
  byId: (userId: number | string) => `/users/${userId}`,
} as const

// ---------------------------------------------------------------------------
// Market Data
// ---------------------------------------------------------------------------
const MARKET_DATA = '/market_data'

export const ASSET_ROUTES = {
  list: `${MARKET_DATA}/asset`,
  create: `${MARKET_DATA}/asset`,
  byId: (assetId: number | string) => `${MARKET_DATA}/asset/${assetId}`,
  type: `${MARKET_DATA}/asset/type`,
  fixedIncome: `${MARKET_DATA}/asset/fixed_income`,
  fixedIncomeType: `${MARKET_DATA}/asset/fixed_income/type`,
  fiiSegment: `${MARKET_DATA}/asset/fii/segment`,
  etfSegment: `${MARKET_DATA}/asset/etf/segment`,
  treasuryBondType: `${MARKET_DATA}/asset/treasury_bond/type`,
  exchange: `${MARKET_DATA}/asset/exchange`,
  favorites: `${MARKET_DATA}/asset/favorites`,
  visit: (assetId: number | string) => `${MARKET_DATA}/asset/${assetId}/visit`,
  sync: `${MARKET_DATA}/asset/sync`,
  registrySync: `${MARKET_DATA}/asset/registry_sync`,
  fundLink: `${MARKET_DATA}/asset/fund_link`,
  fundLinkSuggestions: `${MARKET_DATA}/asset/fund_link/suggestions`,
  event: `${MARKET_DATA}/asset/event`,
  registerFund: `${MARKET_DATA}/asset/fund`,
  fundSeries: (assetId: number | string) => `${MARKET_DATA}/asset/fund/${assetId}/series`,
  fundSeriesAliases: (assetId: number | string) =>
    `${MARKET_DATA}/asset/fund/${assetId}/series-aliases`,
  eventById: (eventId: number | string) => `${MARKET_DATA}/asset/event/${eventId}`,
} as const

export const BROKER_ROUTES = {
  list: `${MARKET_DATA}/broker`,
  create: `${MARKET_DATA}/broker`,
  byId: (brokerId: number | string) => `${MARKET_DATA}/broker/${brokerId}`,
} as const

export const CURRENCY_ROUTES = {
  list: `${MARKET_DATA}/currency`,
} as const

// There is no "index": IFIX, S&P500, IBOVESPA, NASDAQ and the MSCI indexes are of the
// market_index *type*, while CDI is an interest rate and IPCA an inflation
// rate. All of them are market-data series, and this is the only way to them.
export const MARKET_DATA_SERIES_ROUTES = {
  list: `${MARKET_DATA}/series`,
  options: `${MARKET_DATA}/series/options`,
  timeSeries: `${MARKET_DATA}/series/time_series`,
  history: (seriesId: number | string) => `${MARKET_DATA}/series/${seriesId}/history`,
} as const

// Where each series stands against its own history, computed server-side so
// the screen never downloads decades of daily closes to rank one number.
export const MARKET_READING_ROUTES = {
  world: `${MARKET_DATA}/readings/world`,
  etfs: `${MARKET_DATA}/readings/etfs`,
} as const

export const USD_BRL_ROUTES = {
  history: `${MARKET_DATA}/usd-brl/history`,
  convert: `${MARKET_DATA}/usd-brl/convert`,
} as const

export const QUOTE_ROUTES = {
  persisted: `${MARKET_DATA}/quotes/persisted`,
  byAsset: (assetId: number | string) => `${MARKET_DATA}/quotes/asset/${assetId}`,
  onDemand: `${MARKET_DATA}/quotes/on-demand`,
} as const

export const FII_ROUTES = {
  market: `${MARKET_DATA}/fii/market`,
  profile: (assetId: number | string) => `${MARKET_DATA}/fii/${assetId}/profile`,
} as const

// Um fundo de investimento aqui é o que não é FII nem ETF: FIAGRO, FI-Infra,
// FIDC, FIP e FIF. Os dois de fora têm leitura própria — o FII publica prédios
// e vacância, e o ETF se lê como qualquer ativo listado.
// O cadastro de fundos do regulador. Uma linha dele não é ativo: vira ativo só
// quando a unidade precificada — classe, subclasse ou série — é cadastrada.
export const FUND_REGISTRY_ROUTES = {
  search: `${MARKET_DATA}/fund_registry`,
  class: (classId: number | string) => `${MARKET_DATA}/fund_registry/class/${classId}`,
  series: (classId: number | string) => `${MARKET_DATA}/fund_registry/class/${classId}/series`,
} as const

export const ETF_ROUTES = {
  profile: (assetId: number | string) => `${MARKET_DATA}/etf/${assetId}/profile`,
  holdings: (assetId: number | string) => `${MARKET_DATA}/etf/${assetId}/holdings`,
} as const

export const INVESTMENT_FUND_ROUTES = {
  market: `${MARKET_DATA}/investment_fund/market`,
  profile: (assetId: number | string) => `${MARKET_DATA}/investment_fund/${assetId}/profile`,
} as const

// Uma ação não tem rota de catálogo própria: a lista de ações é a genérica de
// `MARKET_CATALOGUE_ROUTES`. O que ela tem de seu é o perfil, que reúne o que a
// companhia arquiva com o que o mercado paga por isso.
export const STOCK_ROUTES = {
  profile: (assetId: number | string) => `${MARKET_DATA}/stock/${assetId}/profile`,
} as const

export type MarketCatalogueKind =
  | 'stock'
  | 'etf'
  | 'fii'
  | 'bdr'
  | 'crypto'
  | 'stock-us'
  | 'etf-us'

export const MARKET_CATALOGUE_ROUTES = {
  byKind: (kind: MarketCatalogueKind) => `${MARKET_DATA}/market/${kind}`,
} as const

// ---------------------------------------------------------------------------
// Operations: what runs, when, and how it ended
// ---------------------------------------------------------------------------
const OPERATIONS = '/operations'

export const OPERATIONS_ROUTES = {
  dashboard: `${OPERATIONS}/dashboard`,
  runs: `${OPERATIONS}/runs`,
  runRoutine: (routine: string) => `${OPERATIONS}/routines/${routine}/run`,
} as const

export const DATA_INGESTION_ROUTES = {
  list: (ingestionType: string) =>
    `${MARKET_DATA}/ingestions/${ingestionType}`,
  byId: (ingestionType: string, executionId: number | string) =>
    `${MARKET_DATA}/ingestions/${ingestionType}/${executionId}`,
  run: (ingestionType: string) =>
    `${MARKET_DATA}/ingestions/${ingestionType}`,
  abort: (ingestionType: string, executionId: number | string) =>
    `${MARKET_DATA}/ingestions/${ingestionType}/${executionId}/abort`,
} as const

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------
const PORTFOLIO = '/portfolio'

export const PORTFOLIO_ROUTES = {
  list: PORTFOLIO,
  all: `${PORTFOLIO}/all`,
  create: PORTFOLIO,
  byId: (portfolioId: number | string) => `${PORTFOLIO}/${portfolioId}`,
} as const

export const WEALTH_TIER_ROUTES = {
  status: (portfolioId: number | string) => `${PORTFOLIO}/wealth_tier/status/${portfolioId}`,
} as const

export const CATEGORY_ROUTES = {
  save: `${PORTFOLIO}/category`,
  byId: (categoryId: number | string) => `${PORTFOLIO}/category/${categoryId}`,
  assignment: `${PORTFOLIO}/category/assignment`,
} as const

export const DIVIDEND_ROUTES = {
  list: `${PORTFOLIO}/dividend`,
  create: `${PORTFOLIO}/dividend`,
  byId: (dividendId: number | string) => `${PORTFOLIO}/dividend/${dividendId}`,
} as const

export const INCOME_TAX_ROUTES = {
  assessment: `${PORTFOLIO}/income_tax/assessment`,
  darfPayments: `${PORTFOLIO}/income_tax/darf_payment`,
  darfPayment: (paymentId: number | string) => `${PORTFOLIO}/income_tax/darf_payment/${paymentId}`,
} as const

export const POSITION_ROUTES = {
  byPortfolio: (portfolioId: number | string) => `${PORTFOLIO}/position/${portfolioId}`,
  returns: (portfolioId: number | string) => `${PORTFOLIO}/position/${portfolioId}/returns`,
  consolidation: (portfolioId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/consolidation`,
  // Os ativos que a carteira teve e não tem mais. Leitura própria: uma posição
  // encerrada não tem valor de mercado nem peso, e o que se pergunta dela só
  // existe depois que ela acabou.
  closed: (portfolioId: number | string) => `${PORTFOLIO}/position/${portfolioId}/closed`,
  assetTypeReturns: (portfolioId: number | string, assetTypeId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/asset-type/${assetTypeId}/returns`,
  assetTypeAnalysis: (portfolioId: number | string, assetTypeId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/asset-type/${assetTypeId}/analysis`,
  // Um segmento é um recorte da carteira por tipo de ativo e mercado. Quem
  // decide a que segmento um ativo pertence é o backend; aqui só se nomeia.
  segmentReturns: (portfolioId: number | string, segment: string) =>
    `${PORTFOLIO}/position/${portfolioId}/segment/${segment}/returns`,
  segmentAnalysis: (portfolioId: number | string, segment: string) =>
    `${PORTFOLIO}/position/${portfolioId}/segment/${segment}/analysis`,
  patrimonyEvolution: (portfolioId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/patrimony_evolution`,
  contributionAverage: (portfolioId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/contribution-average`,
  cdiCagr: (portfolioId: number | string) => `${PORTFOLIO}/position/${portfolioId}/cdi-cagr`,
  analysis: (portfolioId: number | string) => `${PORTFOLIO}/position/${portfolioId}/analysis`,
  categoryReturns: (portfolioId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/category/returns`,
  categoryAnalysis: (portfolioId: number | string, categoryId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/category/${categoryId}/analysis`,
  assetReturns: (portfolioId: number | string, assetId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/asset/${assetId}/returns`,
  assetDetails: (portfolioId: number | string, assetId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/asset/${assetId}/details`,
  assetAnalysis: (portfolioId: number | string, assetId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/asset/${assetId}/analysis`,
} as const

export const POSITION_CONSOLIDATOR_ROUTES = {
  consolidate: (portfolioId: number | string) =>
    `${PORTFOLIO}/position_consolidator/${portfolioId}/consolidate`,
  recalculateAssetPosition: (portfolioId: number | string) =>
    `${PORTFOLIO}/position_consolidator/${portfolioId}/recalculate_asset_position`,
  recalculateAllPosition: (portfolioId: number | string) =>
    `${PORTFOLIO}/position_consolidator/${portfolioId}/recalculate_all_position`,
  consolidatePortfolioReturns: (portfolioId: number | string) =>
    `${PORTFOLIO}/position_consolidator/${portfolioId}/consolidate_portfolio_returns`,
  consolidateCategoryReturns: (portfolioId: number | string) =>
    `${PORTFOLIO}/position_consolidator/${portfolioId}/consolidate_category_returns`,
  consolidateAssetTypeReturns: (portfolioId: number | string) =>
    `${PORTFOLIO}/position_consolidator/${portfolioId}/consolidate_asset_type_returns`,
} as const

export const REBALANCING_ROUTES = {
  byPortfolio: (portfolioId: number | string) => `${PORTFOLIO}/rebalancing/${portfolioId}`,
} as const

export const REPORT_ROUTES = {
  performanceStatement: (portfolioId: number | string) =>
    `${PORTFOLIO}/report/${portfolioId}/performance_statement.xlsx`,
} as const

export const TRANSACTION_ROUTES = {
  list: `${PORTFOLIO}/transaction`,
  create: `${PORTFOLIO}/transaction`,
  byId: (transactionId: number | string) => `${PORTFOLIO}/transaction/${transactionId}`,
} as const

export const BROKERAGE_NOTE_ROUTES = {
  notes: `${PORTFOLIO}/brokerage_note`,
  extraction: `${PORTFOLIO}/brokerage_note/extraction`,
  reconciliation: `${PORTFOLIO}/brokerage_note/reconciliation`,
} as const

export const PORTFOLIO_DOCUMENT_ROUTES = {
  list: `${PORTFOLIO}/document`,
  content: (documentId: number) => `${PORTFOLIO}/document/${documentId}/content`,
} as const

export const POSITION_STATEMENT_ROUTES = {
  extraction: `${PORTFOLIO}/position_statement/extraction`,
  comparison: `${PORTFOLIO}/position_statement/comparison`,
} as const

export const USER_CONFIGURATION_ROUTES = {
  byPortfolio: (portfolioId: number | string) =>
    `${PORTFOLIO}/user_configuration/${portfolioId}`,
} as const

// ---------------------------------------------------------------------------
// Laboratório
// ---------------------------------------------------------------------------
const LAB = '/lab'

// O backtest recebe a alocação inteira no corpo e não o id de uma carteira
// salva: é o que deixa simular um rascunho que ninguém salvou, e o que faz o
// comparador e o painel de variações usarem a mesma rota.
export const LAB_ROUTES = {
  portfolio: `${LAB}/portfolio`,
  portfolioById: (id: number | string) => `${LAB}/portfolio/${id}`,
  preset: `${LAB}/preset`,
  backtest: `${LAB}/backtest`,
  backtestComparison: `${LAB}/backtest/comparison`,
} as const

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------
const RESEARCH = '/research'

export const RESEARCH_ROUTES = {
  source: `${RESEARCH}/source`,
  recommendedPortfolio: `${RESEARCH}/recommended_portfolio`,
  recommendedPortfolioExtraction: `${RESEARCH}/recommended_portfolio/extraction`,
  recommendedPortfolioById: (id: number | string) => `${RESEARCH}/recommended_portfolio/${id}`,
  recommendationConsensus: `${RESEARCH}/recommendation_consensus`,
  recommendedPortfolioType: `${RESEARCH}/recommended_portfolio_type`,
  recommendedPortfolioTypeById: (id: number | string) =>
    `${RESEARCH}/recommended_portfolio_type/${id}`,
} as const

// ---------------------------------------------------------------------------
// IA
// ---------------------------------------------------------------------------
const AI = '/ai'

// A feature é endereçada pela `key` e não por id: a chave é a identidade de
// domínio de uma capacidade de IA, é ela que o admin executa e ela que a rota
// de produto pede.
export const AI_ROUTES = {
  feature: `${AI}/feature`,
  featureByKey: (key: string) => `${AI}/feature/${key}`,
  featureForm: (key: string) => `${AI}/feature/${key}/form`,
  featureRun: (key: string) => `${AI}/feature/${key}/run`,
  featureSchedule: (key: string) => `${AI}/feature/${key}/schedule`,
  featurePromptVersion: (key: string) => `${AI}/feature/${key}/prompt_version`,
  promptVersionActivate: (versionId: number | string) =>
    `${AI}/prompt_version/${versionId}/activate`,
  usage: `${AI}/usage`,
  run: `${AI}/run`,
  assetDescriptionDraft: `${AI}/asset_description_draft`,
} as const
