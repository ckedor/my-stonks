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
  index: `${MARKET_DATA}/asset/index`,
  event: `${MARKET_DATA}/asset/event`,
  eventById: (eventId: number | string) => `${MARKET_DATA}/asset/event/${eventId}`,
} as const

export const BROKER_ROUTES = {
  list: `${MARKET_DATA}/broker`,
  create: `${MARKET_DATA}/broker`,
  byId: (brokerId: number | string) => `${MARKET_DATA}/broker/${brokerId}`,
} as const

export const INDEX_ROUTES = {
  list: `${MARKET_DATA}/index`,
  timeSeries: `${MARKET_DATA}/index/time_series`,
  usdBrl: `${MARKET_DATA}/index/usd_brl`,
  consolidateHistory: `${MARKET_DATA}/index/consolidate_history`,
  currency: `${MARKET_DATA}/index/currency`,
} as const

export const QUOTE_ROUTES = {
  get: `${MARKET_DATA}/quote`,
} as const

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------
const PORTFOLIO = '/portfolio'

export const PORTFOLIO_ROUTES = {
  list: PORTFOLIO,
  create: PORTFOLIO,
  byId: (portfolioId: number | string) => `${PORTFOLIO}/${portfolioId}`,
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
  assetsAndRights: (portfolioId: number | string) =>
    `${PORTFOLIO}/income_tax/${portfolioId}/assets_and_rights`,
  fiiOperation: (portfolioId: number | string) =>
    `${PORTFOLIO}/income_tax/${portfolioId}/variable_income/fii_operation`,
  commonOperation: (portfolioId: number | string) =>
    `${PORTFOLIO}/income_tax/${portfolioId}/variable_income/common_operation`,
  darf: (portfolioId: number | string) => `${PORTFOLIO}/income_tax/${portfolioId}/darf`,
} as const

export const POSITION_ROUTES = {
  byPortfolio: (portfolioId: number | string) => `${PORTFOLIO}/position/${portfolioId}`,
  returns: (portfolioId: number | string) => `${PORTFOLIO}/position/${portfolioId}/returns`,
  patrimonyEvolution: (portfolioId: number | string) =>
    `${PORTFOLIO}/position/${portfolioId}/patrimony_evolution`,
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

export const USER_CONFIGURATION_ROUTES = {
  byPortfolio: (portfolioId: number | string) =>
    `${PORTFOLIO}/user_configuration/${portfolioId}`,
} as const

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------
const AI = '/ai'

export const AI_ROUTES = {
  feature: `${AI}/feature`,
  featureById: (featureId: number | string) => `${AI}/feature/${featureId}`,
  assetOverviewAndNews: `${AI}/asset_overview_and_news`,
} as const
