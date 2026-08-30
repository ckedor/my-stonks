import { WEALTH_TIER_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import type { PortfolioWealthTier, WealthTier } from '@/types'

/* Só leitura: a escala é fixa no código do backend, ao lado dos cenários
   desenhados para ela. Não há o que criar, editar ou apagar. */

export const fetchWealthTiers = (): Promise<WealthTier[]> =>
  api.get<WealthTier[]>(WEALTH_TIER_ROUTES.list).then((r) => r.data)

export const fetchPortfolioWealthTier = (portfolioId: number): Promise<PortfolioWealthTier> =>
  api.get<PortfolioWealthTier>(WEALTH_TIER_ROUTES.status(portfolioId)).then((r) => r.data)
