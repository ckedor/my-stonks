import { WEALTH_TIER_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import type { PortfolioWealthTier } from '@/types'

/* Só leitura: a escala é fixa no código do backend. Não há o que criar,
   editar ou apagar. */

export const fetchPortfolioWealthTier = (portfolioId: number): Promise<PortfolioWealthTier> =>
  api.get<PortfolioWealthTier>(WEALTH_TIER_ROUTES.status(portfolioId)).then((r) => r.data)
