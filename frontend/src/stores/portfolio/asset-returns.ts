import type { ReturnsEntry } from '@/types'
import { create } from 'zustand'

/* As séries dos ativos que já foram abertos nesta sessão.
 *
 * Não é cache de servidor, e por isso não é uma query: é o acúmulo do que quem
 * usa já olhou. O gráfico da carteira oferece cada uma como curva selecionável,
 * e quem alimenta é a tela do ativo — a única que sabe qual ativo está aberto.
 * Some ao recarregar, de propósito: o menu volta a oferecer só o que a sessão
 * atual visitou. */
interface AssetReturnsState {
  assetReturns: Record<string, ReturnsEntry[]>
  addAssetReturns: (entries: Record<string, ReturnsEntry[]>) => void
}

export const useAssetReturnsStore = create<AssetReturnsState>()((set) => ({
  assetReturns: {},
  addAssetReturns: (entries) =>
    set((state) => ({ assetReturns: { ...state.assetReturns, ...entries } })),
}))
