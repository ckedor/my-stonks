import type { PortfolioWealthTier } from '@/types'
import { create } from 'zustand'

export interface WealthTierState {
  standing: PortfolioWealthTier | null
  loading: boolean

  setStanding: (standing: PortfolioWealthTier | null) => void
  setLoading: (loading: boolean) => void
}

export const useWealthTierStore = create<WealthTierState>()((set) => ({
  standing: null,
  loading: true,

  setStanding: (standing) => set({ standing, loading: false }),
  setLoading: (loading) => set({ loading }),
}))
