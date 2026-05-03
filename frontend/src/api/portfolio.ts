import {
  DIVIDEND_ROUTES,
  PORTFOLIO_ROUTES,
  POSITION_CONSOLIDATOR_ROUTES,
  POSITION_ROUTES,
  TRANSACTION_ROUTES,
} from '@/constants/routes'
import api from '@/lib/api'
import type { AssetAnalysis, CategoryReturnEntry, Dividend, PatrimonyEntry, Portfolio, PortfolioPositionEntry, PortfolioReturnEntry, ReturnsEntry, Trade } from '@/types'

// ---------------------------------------------------------------------------
// Pure API functions – no state management, no side-effects beyond the fetch.
// ---------------------------------------------------------------------------

export const fetchPortfolios = (): Promise<Portfolio[]> =>
  api.get<Portfolio[]>(PORTFOLIO_ROUTES.list).then((r) => r.data)

export const fetchPositions = (portfolioId: number, currency: string = 'BRL'): Promise<PortfolioPositionEntry[]> =>
  api.get<PortfolioPositionEntry[]>(POSITION_ROUTES.byPortfolio(portfolioId), { params: { currency } }).then((r) => r.data)

export const fetchDividends = (portfolioId: number, currency: string = 'BRL'): Promise<Dividend[]> =>
  api.get<Dividend[]>(DIVIDEND_ROUTES.list, { params: { portfolio_id: portfolioId, currency } }).then((r) => r.data)

export const fetchPatrimony = (portfolioId: number, currency: string = 'BRL'): Promise<PatrimonyEntry[]> =>
  api.get<PatrimonyEntry[]>(POSITION_ROUTES.patrimonyEvolution(portfolioId), { params: { currency } }).then((r) => r.data).catch((err) => {
    if (err?.response?.status === 404) return []
    throw err
  })

export const fetchTrades = (portfolioId: number): Promise<Trade[]> =>
  api.get<Trade[]>(TRANSACTION_ROUTES.list, { params: { portfolio_id: portfolioId } }).then((r) => r.data)

export const fetchReturns = (portfolioId: number, currency: string = 'BRL'): Promise<PortfolioReturnEntry[]> =>
  api.get<PortfolioReturnEntry[]>(POSITION_ROUTES.returns(portfolioId), { params: { currency } }).then((r) => r.data ?? [])

export const fetchCategoryReturns = (
  portfolioId: number,
  categoryId?: number,
  mostRecent?: boolean,
  currency: string = 'BRL',
): Promise<CategoryReturnEntry[]> => {
  const params: Record<string, string | number | boolean> = { currency }
  if (categoryId != null) params.category_id = categoryId
  if (mostRecent) params.most_recent = true
  return api.get<CategoryReturnEntry[]>(POSITION_ROUTES.categoryReturns(portfolioId), { params }).then((r) => r.data ?? [])
}

export const fetchCategoryAnalysis = (portfolioId: number, categoryId: number, currency: string = 'BRL'): Promise<AssetAnalysis> =>
  api.get<AssetAnalysis>(POSITION_ROUTES.categoryAnalysis(portfolioId, categoryId), { params: { currency } }).then((r) => r.data)

export const fetchAssetReturns = (portfolioId: number, assetId: number, currency: string = 'BRL'): Promise<Record<string, ReturnsEntry[]>> =>
  api.get(POSITION_ROUTES.assetReturns(portfolioId, assetId), { params: { currency } }).then((r) => {
    const rows: Record<string, any>[] = r.data?.data ?? r.data ?? []
    // df_response returns [{date, TICKER: value, ...}, ...] — pivot to {TICKER: [{date, value}]}
    const result: Record<string, ReturnsEntry[]> = {}
    for (const row of rows) {
      const { date, ...rest } = row
      for (const [ticker, val] of Object.entries(rest)) {
        if (val == null) continue
        if (!result[ticker]) result[ticker] = []
        result[ticker].push({ date, value: val as number })
      }
    }
    return result
  })

export const fetchAssetDetails = (portfolioId: number, assetId: number, currency: string = 'BRL') =>
  api.get(POSITION_ROUTES.assetDetails(portfolioId, assetId), { params: { currency } }).then((r) => r.data)

export const fetchAssetAnalysis = (portfolioId: number, assetId: number, currency: string = 'BRL'): Promise<AssetAnalysis | null> =>
  api.get<AssetAnalysis>(POSITION_ROUTES.assetAnalysis(portfolioId, assetId), { params: { currency } }).then((r) => r.data).catch(() => null)

export const fetchAnalysis = (portfolioId: number, currency: string = 'BRL'): Promise<AssetAnalysis> =>
  api.get<AssetAnalysis>(POSITION_ROUTES.analysis(portfolioId), { params: { currency } }).then((r) => r.data)

export const consolidatePortfolio = (portfolioId: number): Promise<void> =>
  api.post(POSITION_CONSOLIDATOR_ROUTES.consolidate(portfolioId)).then(() => undefined)

export const recalculateAssetPosition = (portfolioId: number, assetId: number): Promise<void> =>
  api.post(POSITION_CONSOLIDATOR_ROUTES.recalculateAssetPosition(portfolioId), null, { params: { asset_id: assetId } }).then(() => undefined)
