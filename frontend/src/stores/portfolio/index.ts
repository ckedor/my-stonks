import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* Qual carteira está selecionada — e só isso.
 *
 * A lista de carteiras é dado de servidor e vem de `usePortfolios()`; qual
 * delas está aberta é escolha de quem usa, e sobrevive à recarga. Os dois
 * moravam aqui juntos, o que dava duas fontes para a mesma lista: a query e a
 * cópia persistida do store. Para ler a carteira selecionada já resolvida,
 * use `useSelectedPortfolio()`. */
interface SelectedPortfolioState {
  selectedPortfolioId: number | null
  setSelectedPortfolioId: (id: number) => void
}

export const usePortfolioStore = create<SelectedPortfolioState>()(
  persist(
    (set) => ({
      selectedPortfolioId: null,
      setSelectedPortfolioId: (selectedPortfolioId) => set({ selectedPortfolioId }),
    }),
    { name: 'selected-portfolio' },
  ),
)
