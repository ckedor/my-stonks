import type { PortfolioPositionEntry, ReturnsEntry } from '@/types'

export interface CategorySummary {
  /** Soma das posições da categoria hoje. */
  value: number
  /** Quanto a categoria pesa na carteira, em pontos percentuais. Nulo quando
   *  a carteira não vale nada — a divisão não tem resposta, e zero seria uma. */
  weight: number | null
  /** Rentabilidade acumulada da categoria, em fração. Nulo sem histórico. */
  accReturn: number | null
  assetCount: number
}

/** As posições de uma categoria, da maior para a menor.
 *
 *  A ordem é por valor porque a grade de cards é lida de cima para baixo: o
 *  que decide a categoria aparece primeiro. */
export function categoryPositions(
  positions: PortfolioPositionEntry[],
  category: string,
): PortfolioPositionEntry[] {
  return positions
    .filter((position) => position.category === category)
    .sort((a, b) => b.value - a.value)
}

/** Os números do cabeçalho da categoria.
 *
 *  `positions` é a carteira inteira: o peso da categoria só existe contra o
 *  total, e recortar antes de somar o perderia. */
export function summarizeCategory(
  positions: PortfolioPositionEntry[],
  returns: ReturnsEntry[],
  category: string,
): CategorySummary {
  const own = categoryPositions(positions, category)
  const value = own.reduce((sum, position) => sum + position.value, 0)
  const total = positions.reduce((sum, position) => sum + position.value, 0)
  const last = returns.length > 0 ? returns[returns.length - 1] : null

  return {
    value,
    weight: total > 0 ? (value / total) * 100 : null,
    accReturn: last ? last.value : null,
    assetCount: own.length,
  }
}
