import { POSITION_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import type { PortfolioConsolidation } from '@/types'

/** Quando a carteira foi consolidada pela última vez, ou null se nunca foi. */
export const fetchConsolidation = (portfolioId: number): Promise<PortfolioConsolidation | null> =>
  api
    .get<PortfolioConsolidation | null>(POSITION_ROUTES.consolidation(portfolioId))
    .then((r) => r.data ?? null)
