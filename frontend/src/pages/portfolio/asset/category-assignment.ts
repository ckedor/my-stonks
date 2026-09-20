import { CATEGORY_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { EMPTY_LIST } from '@/queries/empty'
import { useRefreshPortfolio, useSelectedPortfolio } from '@/queries/portfolio'
import type { UserCategory } from '@/types'
import { useCallback, useState } from 'react'

/* Trocar a categoria de um ativo, das duas listas da tela de Ativos.
 *
 * A troca é a mesma dos dois lados, e o ativo também: a categoria é do ativo
 * na carteira, não da posição. Por isso ela vale igual para o que ainda está
 * em carteira e para o que já foi vendido — reclassificar uma posição
 * encerrada é o que conserta o histórico de uma categoria.
 *
 * O estado é um só por lista — qual troca espera confirmação —, então ele
 * mora no gancho e o diálogo é montado uma vez, e não uma vez por linha. */

interface PendingChange {
  assetId: number
  categoryId: number
}

export interface CategoryAssignment {
  /** As categorias da carteira aberta, na ordem em que ela as guarda. */
  categories: UserCategory[]
  /** Pede a troca. Ela só acontece depois da confirmação. */
  request: (assetId: number, categoryId: number) => void
  pending: PendingChange | null
  confirm: () => Promise<void>
  cancel: () => void
  failed: boolean
  dismissFailure: () => void
}

export function useCategoryAssignment(): CategoryAssignment {
  const selectedPortfolio = useSelectedPortfolio()
  const refreshPortfolio = useRefreshPortfolio()
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [failed, setFailed] = useState(false)

  const request = useCallback((assetId: number, categoryId: number) => {
    setPending({ assetId, categoryId })
  }, [])

  const confirm = useCallback(async () => {
    if (!pending || !selectedPortfolio) return
    try {
      await api.post(CATEGORY_ROUTES.assignment, {
        asset_id: pending.assetId,
        category_id: pending.categoryId,
        portfolio_id: selectedPortfolio.id,
      })
      setPending(null)
      void refreshPortfolio()
    } catch {
      setFailed(true)
    }
  }, [pending, selectedPortfolio, refreshPortfolio])

  return {
    categories: selectedPortfolio?.custom_categories ?? EMPTY_LIST,
    request,
    pending,
    confirm,
    cancel: useCallback(() => setPending(null), []),
    failed,
    dismissFailure: useCallback(() => setFailed(false), []),
  }
}
