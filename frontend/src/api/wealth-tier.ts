import { WEALTH_TIER_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import type { PortfolioWealthTier, WealthTier } from '@/types'

export interface WealthTierPayload {
  rank: number
  name: string
  threshold: number
  artwork?: string | null
  artwork_offset?: number
  artwork_height?: number | null
}

export const fetchWealthTiers = (): Promise<WealthTier[]> =>
  api.get<WealthTier[]>(WEALTH_TIER_ROUTES.list).then((r) => r.data)

export const fetchPortfolioWealthTier = (portfolioId: number): Promise<PortfolioWealthTier> =>
  api.get<PortfolioWealthTier>(WEALTH_TIER_ROUTES.status(portfolioId)).then((r) => r.data)

export const createWealthTier = (payload: WealthTierPayload): Promise<WealthTier> =>
  api.post<WealthTier>(WEALTH_TIER_ROUTES.create, payload).then((r) => r.data)

export const updateWealthTier = (
  tierId: number,
  payload: Partial<WealthTierPayload>,
): Promise<WealthTier> =>
  api.put<WealthTier>(WEALTH_TIER_ROUTES.byId(tierId), payload).then((r) => r.data)

export const deleteWealthTier = (tierId: number): Promise<void> =>
  api.delete(WEALTH_TIER_ROUTES.byId(tierId)).then(() => undefined)
