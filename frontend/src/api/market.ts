import type { CandleDataPoint } from '@/components/charts/CandleChart'
import { ASSET_ROUTES, CURRENCY_ROUTES, FII_ROUTES, MARKET_CATALOGUE_ROUTES, MARKET_DATA_SERIES_ROUTES, QUOTE_ROUTES, USD_BRL_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import type { ReturnsEntry } from '@/types'

export type BenchmarksPayload = Record<string, ReturnsEntry[]>

export const fetchBenchmarks = (currency: 'BRL' | 'USD' = 'BRL'): Promise<BenchmarksPayload> =>
  api
    .get<BenchmarksPayload>(MARKET_DATA_SERIES_ROUTES.timeSeries, { params: { currency } })
    .then((r) => r.data)

// ---------------------------------------------------------------------------
// Market data inspection (admin)
// ---------------------------------------------------------------------------

export interface UsdBrlHistoryPoint {
  date: string
  /** BRL value of one USD. */
  usd_brl: string
  /** USD value of one BRL, precomputed at ingestion. */
  brl_usd: string
  source: string
}

export const fetchUsdBrlHistory = (startDate?: string): Promise<UsdBrlHistoryPoint[]> =>
  api
    .get<UsdBrlHistoryPoint[]>(USD_BRL_ROUTES.history, {
      params: { start_date: startDate },
    })
    .then((r) => r.data)

export interface MarketDataSeriesOption {
  id: number
  short_name: string
  name: string
  symbol: string
}

export const fetchMarketDataSeriesOptions = (): Promise<MarketDataSeriesOption[]> =>
  api.get<MarketDataSeriesOption[]>(MARKET_DATA_SERIES_ROUTES.options).then((r) => r.data)

export interface MarketDataSeriesHistoryPoint {
  date: string
  close: number | null
  open: number | null
  high: number | null
  low: number | null
  source: string | null
}

export const fetchMarketDataSeriesHistory = (
  seriesId: number,
  startDate?: string,
): Promise<MarketDataSeriesHistoryPoint[]> =>
  api
    .get<MarketDataSeriesHistoryPoint[]>(MARKET_DATA_SERIES_ROUTES.history(seriesId), {
      params: { start_date: startDate },
    })
    .then((r) => r.data)

export interface Currency {
  id: number
  code: string
  name: string
}

export const fetchCurrencies = (): Promise<Currency[]> =>
  api.get<Currency[]>(CURRENCY_ROUTES.list).then((r) => r.data)

export interface PersistedQuote {
  date: string
  close: number | null
  open: number | null
  high: number | null
  low: number | null
  adjusted_close: number | null
  volume: number | null
  currency_id: number | null
  source: string | null
}

export interface PersistedQuotesEntry {
  asset_id: number
  ticker: string
  asset_type_id: number
  quotes: PersistedQuote[]
}

export const fetchPersistedQuotes = (
  assetId: number,
  startDate?: string,
): Promise<PersistedQuotesEntry[]> =>
  api
    .get<PersistedQuotesEntry[]>(QUOTE_ROUTES.persisted, {
      params: { asset_ids: [assetId], start_date: startDate },
    })
    .then((r) => r.data)

export interface QuotesResponse {
  ticker: string
  asset_type: string
  currency: string | null
  /** Provider-hosted brand image, absent for tickers without one. */
  logo_url: string | null
  quotes: {
    date: string
    open: number | null
    high: number | null
    low: number | null
    close: number
    adjusted_close: number | null
    volume: number | null
  }[]
}

/** Annualized growth over the whole served history.
 *
 * The window travels with the rate: the same percentage means very different
 * things over three years and over thirty. */
export interface HistoricalCagr {
  value: number
  start_date: string
  end_date: string
}

export interface AssetQuoteHistory extends QuotesResponse {
  /** Where the quotes came from: 'database' or 'provider'. */
  source: 'database' | 'provider'
  /** Absent when the history is too short to annualize honestly. */
  cagr: HistoricalCagr | null
}

/** History for one asset, served from storage when we have it.
 *
 * Prices come back in `currency`; the backend converts through the USD/BRL
 * history when the asset is not quoted in it, and reports which currency the
 * quotes ended up in. */
export const fetchAssetQuoteHistory = (
  assetId: number,
  startDate?: string,
  currency: string = 'BRL',
): Promise<AssetQuoteHistory> =>
  api
    .get<AssetQuoteHistory>(QUOTE_ROUTES.byAsset(assetId), {
      params: { start_date: startDate, currency },
    })
    .then((r) => r.data)

export const fetchOnDemandAssetQuotes = (
  ticker: string,
  assetTypeId: number,
  startDate?: string,
): Promise<QuotesResponse> =>
  api.get<QuotesResponse>(QUOTE_ROUTES.onDemand, {
    params: { ticker, asset_type_id: assetTypeId, start_date: startDate },
  }).then((r) => r.data)

export function quotesToCandleData(quotes: QuotesResponse['quotes']): CandleDataPoint[] {
  return quotes.map((q) => ({
    time: q.date.slice(0, 10),
    open: q.open ?? q.close,
    high: q.high ?? q.close,
    low: q.low ?? q.close,
    close: q.close,
    adjustedClose: q.adjusted_close ?? undefined,
    volume: q.volume ?? undefined,
  }))
}


// ---------------------------------------------------------------------------
// Real-estate fund profile
// ---------------------------------------------------------------------------

/** One payment per share made by a fund. Always BRL: these funds pay in reais
 *  and the backend does not restate them.
 *
 *  `event_type` is the fund's own label — an ordinary distribution
 *  (`RENDIMENTO`) or an amortization of capital. A reader that means income
 *  filters on it rather than summing the two. */
export interface FIIDividend {
  payment_date: string
  ex_date: string | null
  value_per_share: number
  event_type: string | null
}

/** What the fund reports about itself, as of its last published report.
 *
 *  Every field is optional: a provider that has never covered a fund, or that
 *  drops one indicator, must cost the card that one value and nothing else. An
 *  absent indicator is null, never zero — an unknown P/VP and a P/VP of zero
 *  are different statements.
 *
 *  The yields and the monthly return are ratios — 0.12381 is 12.381% — so it
 *  is the presentation that scales them. `price_to_nav` is the published P/VP,
 *  a multiple around 1. Monetary fields are in BRL. */
export interface FIIIndicators {
  as_of_date: string | null
  segment_type: string | null
  segment: string | null
  price: number | null
  nav_per_share: number | null
  price_to_nav: number | null
  dividend_yield_12m: number | null
  dividend_yield_1m: number | null
  monthly_return: number | null
  equity: number | null
  total_assets: number | null
  shares_outstanding: number | null
  shareholders: number | null
}

/** Who runs the fund and under which mandate. Published beside the indicators
 *  and kept apart from them: none of it is a measurement. */
export interface FIIManagement {
  cnpj: string | null
  mandate: string | null
  management_type: string | null
  administrator_name: string | null
  administrator_website: string | null
}

/** The monthly filing: what the fund's equity is made of, in reais.
 *
 *  The rates are ratios like everywhere else here, and the monetary fields are
 *  absolute amounts — not per share. */
export interface FIIMonthlyReport {
  reference_date: string | null
  admin_fee_rate: number | null
  monthly_patrimonial_return: number | null
  amortization_rate: number | null
  equity: number | null
  total_assets: number | null
  total_invested: number | null
  cash: number | null
  liquidity_needs: number | null
  government_bonds: number | null
  private_bonds: number | null
  fixed_income_funds: number | null
  real_estate: number | null
  real_estate_company_shares: number | null
  real_estate_company_units: number | null
  cri: number | null
  lci: number | null
  fii_holdings: number | null
  receivables: number | null
  rental_receivables: number | null
  other_receivables: number | null
  distributions_payable: number | null
  admin_fees_payable: number | null
  real_estate_obligations: number | null
  total_liabilities: number | null
}

/** The fund's buildings added up, as of one quarter.
 *
 *  `vacancy_rate` is consolidated and `average_vacancy_rate` is the plain
 *  average across buildings: one empty warehouse among thirty moves the second
 *  far more than the first. Areas are square metres. */
export interface FIIPropertySummary {
  count: number | null
  total_area: number | null
  vacancy_rate: number | null
  average_vacancy_rate: number | null
  properties_with_vacancy: number | null
}

/** One building, as the fund described it in the quarterly filing.
 *
 *  The construction and sale fields are filled only by funds still building or
 *  selling what they built; a finished income property leaves them null. */
export interface FIIProperty {
  name: string | null
  identifier: string | null
  address: string | null
  property_class: string | null
  area: number | null
  unit_count: number | null
  vacancy_rate: number | null
  delinquency_rate: number | null
  revenue_share: number | null
  leased_rate: number | null
  sold_rate: number | null
  construction_progress_actual: number | null
  construction_progress_expected: number | null
  construction_cost_actual: number | null
  construction_cost_expected: number | null
  invested_share: number | null
  confidential: boolean | null
}

/** One financial asset the fund holds: a CRI, a share in another fund. */
export interface FIIHolding {
  asset_class: string | null
  name: string | null
  issuer: string | null
  issuer_cnpj: string | null
  identifier: string | null
  quantity: number | null
  value: number | null
  issue: string | null
  series: string | null
  ticker: string | null
  maturity_date: string | null
  confidential: boolean | null
}

export interface FIILand {
  name: string | null
  identifier: string | null
  address: string | null
  area: number | null
  invested_share: number | null
  equity_share: number | null
  confidential: boolean | null
}

export interface FIIRight {
  name: string | null
  identifier: string | null
  value: number | null
  description: string | null
  confidential: boolean | null
}

/** How much of one asset class the fund held.
 *
 *  `value` is absent for the buildings: the quarterly filing counts and
 *  describes them, but declares no price for them. */
export interface FIIAllocation {
  asset_class: string
  count: number | null
  value: number | null
}

export interface FIICompositionSummary {
  total_items: number | null
  declared_value: number | null
  properties: FIIPropertySummary | null
  financial_assets_count: number | null
  financial_assets_value: number | null
  lands_count: number | null
  lands_area: number | null
  rights_count: number | null
  rights_value: number | null
}

/** What the fund held at the end of the last quarter it filed for.
 *
 *  Filed quarterly and published months later, so `reference_date` is not
 *  decoration: this is the most recent picture available, not the current one. */
export interface FIIComposition {
  reference_date: string | null
  summary: FIICompositionSummary | null
  allocations: FIIAllocation[]
  properties: FIIProperty[]
  financial_assets: FIIHolding[]
  fund_holdings: FIIHolding[]
  lands: FIILand[]
  rights: FIIRight[]
}

export interface FIICompositionPoint {
  reference_date: string | null
  summary: FIICompositionSummary | null
  allocations: FIIAllocation[]
}

export interface FIIPropertiesPoint {
  reference_date: string | null
  summary: FIIPropertySummary | null
}

/** Everything the fund publishes about itself.
 *
 *  Every section is independent: the backend reads each from a route of its
 *  own and one of them failing costs the page that section, not the profile.
 *  The monthly sections and the quarterly ones also carry different dates,
 *  which is why each states its own. */
export interface FIIProfile {
  ticker: string
  management: FIIManagement | null
  indicators: FIIIndicators | null
  indicators_history: FIIIndicators[]
  dividends: FIIDividend[]
  monthly_report: FIIMonthlyReport | null
  composition: FIIComposition | null
  composition_history: FIICompositionPoint[]
  properties_history: FIIPropertiesPoint[]
}

export const fetchFIIProfile = (assetId: number): Promise<FIIProfile> =>
  api.get<FIIProfile>(FII_ROUTES.profile(assetId)).then((r) => r.data)

export interface FIIMarketFund {
  asset_id: number | null
  ticker: string
  name: string
  cnpj: string | null
  type: string | null
  segment: string | null
  mandate: string | null
  management_type: string | null
  administrator: string | null
  price: number | null
  nav_per_share: number | null
  price_to_nav: number | null
  dividend_yield_12m: number | null
  investors: number | null
}

export interface FIIMarket {
  funds: FIIMarketFund[]
  total: number
  source: string
}

export const fetchFIIMarket = (): Promise<FIIMarket> =>
  api.get<FIIMarket>(FII_ROUTES.market).then((r) => r.data)


// ---------------------------------------------------------------------------
// Market catalogues
// ---------------------------------------------------------------------------

export type MarketCatalogueKind = 'stock' | 'etf' | 'crypto'

export interface MarketCatalogueAsset {
  asset_id: number | null
  ticker: string
  name: string
  price: number | null
  change_percent: number | null
  volume: number | null
  market_cap: number | null
  currency: string
  logo_url: string | null
}

export interface MarketCatalogue {
  assets: MarketCatalogueAsset[]
  total: number
  source: string
}

export const fetchMarketCatalogue = (kind: MarketCatalogueKind): Promise<MarketCatalogue> =>
  api.get<MarketCatalogue>(MARKET_CATALOGUE_ROUTES.byKind(kind)).then((r) => r.data)

export interface MarketAssetDetails {
  id: number
  ticker: string | null
  name: string
  asset_type_id: number
  asset_type: {
    id: number
    short_name: string
    name: string
    asset_class_id: number
  }
}

export const fetchMarketAssetDetails = (assetId: number): Promise<MarketAssetDetails> =>
  api.get<MarketAssetDetails>(ASSET_ROUTES.byId(assetId)).then((r) => r.data)


// ---------------------------------------------------------------------------
// Favourites, ranked by how often the user opens an asset
// ---------------------------------------------------------------------------

export interface FavoriteAsset {
  id: number
  ticker: string | null
  name: string
  asset_type_id: number
  asset_type: { id: number; short_name: string; name: string }
  visit_count: number
  last_visited_at: string | null
}

export const fetchFavoriteAssets = (
  limit = 8,
  assetTypeId?: number,
  assetIds?: number[],
): Promise<FavoriteAsset[]> =>
  api
    .get<FavoriteAsset[]>(ASSET_ROUTES.favorites, {
      params: { limit, asset_type_id: assetTypeId, asset_ids: assetIds },
    })
    .then((r) => r.data)

/** Counts one visit. Always resolves: a lost visit count must never break the
 *  page. Awaited only to reorder the ranking after the backend has taken it. */
export const recordAssetVisit = (assetId: number): Promise<void> =>
  api
    .post(ASSET_ROUTES.visit(assetId))
    .then(() => undefined)
    .catch(() => undefined)
