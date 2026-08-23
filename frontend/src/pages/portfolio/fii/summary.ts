import type { FIIPortfolioPositionEntry, PortfolioPositionEntry } from '@/types'

export type FIIConcentrationDimension = 'type' | 'segment'

export interface FIIConcentrationEntry {
  label: string
  value: number
  assetCount: number
}

const UNCLASSIFIED = 'Não classificado'

export function isFIIPosition(
  position: PortfolioPositionEntry,
): position is FIIPortfolioPositionEntry {
  return position.type_id === 2 || position.type.trim().toUpperCase() === 'FII'
}

export function groupFIIConcentration(
  positions: FIIPortfolioPositionEntry[],
  dimension: FIIConcentrationDimension,
): FIIConcentrationEntry[] {
  const grouped = new Map<string, FIIConcentrationEntry>()

  for (const position of positions) {
    const rawLabel = dimension === 'type' ? position.fii_type : position.fii_segment
    const label = rawLabel?.trim() || UNCLASSIFIED
    const current = grouped.get(label) ?? { label, value: 0, assetCount: 0 }
    current.value += position.value
    current.assetCount += 1
    grouped.set(label, current)
  }

  return [...grouped.values()].sort((a, b) => b.value - a.value)
}
