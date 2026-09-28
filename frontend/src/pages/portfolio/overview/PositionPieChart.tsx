import { useSelectedPortfolio } from '@/queries/portfolio'

import { PortfolioPositionEntry } from '@/types'
import { useMemo } from 'react'
import AppPieChart from '../../../components/ui/app-pie-chart'

/** Como a carteira inteira é fatiada: por categoria ou ativo a ativo. Com uma
 *  categoria selecionada, a pizza é sempre dos ativos dela. */
export type CompositionGrouping = 'category' | 'asset'

interface PositionPieChartProps {
  positions: PortfolioPositionEntry[]
  height?: number
  selectedCategory: string
  grouping?: CompositionGrouping
  onCategorySelect?: (category: string) => void
  onAssetSelect?: (assetId: number) => void
}

export default function PositionPieChart({ positions, height = 350, selectedCategory, grouping = 'category', onCategorySelect, onAssetSelect }: PositionPieChartProps) {
  const byCategory = selectedCategory === 'portfolio' && grouping === 'category'
  const selectedPortfolio = useSelectedPortfolio()
  const userCategories = useMemo(
    () => selectedPortfolio?.custom_categories ?? [],
    [selectedPortfolio?.custom_categories],
  )

  const { data, colors, assetIdMap } = useMemo((): { data: Array<{ label: string; value: number }>; colors: string[]; assetIdMap: Record<string, number> } => {
    if (!positions) return { data: [], colors: [], assetIdMap: {} }

    if (byCategory) {
      const grouped: Record<string, number> = {}

      for (const pos of positions) {
        const categoryName = pos.category ?? '(Sem Categoria)'
        if (!grouped[categoryName]) grouped[categoryName] = 0
        grouped[categoryName] += pos.value
      }

      const sortedData = Object.entries(grouped)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)

      const colorMap: Record<string, string> = {}
      for (const cat of userCategories) {
        colorMap[cat.name] = cat.color
      }

      const colors = sortedData
        .map((item) => colorMap[item.label])
        .filter((color): color is string => Boolean(color))

      return { data: sortedData, colors, assetIdMap: {} }
    } else {
      const inScope = (pos: PortfolioPositionEntry) =>
        selectedCategory === 'portfolio' || pos.category === selectedCategory
      const filtered = positions
        .filter(inScope)
        .map((pos) => ({ label: pos.ticker ?? pos.name, value: pos.value }))
        .sort((a, b) => b.value - a.value)

      // Build ticker -> asset_id map
      const idMap: Record<string, number> = {}
      for (const pos of positions) {
        if (inScope(pos) && pos.asset_id) {
          idMap[pos.ticker ?? pos.name] = pos.asset_id
        }
      }

      return { data: filtered, colors: [], assetIdMap: idMap }
    }
  }, [positions, selectedCategory, userCategories, byCategory])

  const handleItemClick = (label: string) => {
    if (byCategory) {
      // Clicking a category in portfolio view → select that category
      onCategorySelect?.(label)
    } else {
      // Clicking an asset in category view → open asset drawer
      const assetId = assetIdMap[label]
      if (assetId) {
        onAssetSelect?.(assetId)
      }
    }
  }

  return (
    <AppPieChart
      data={data}
      colors={colors}
      isCurrency
      height={height}
      onItemClick={handleItemClick}
      // Ativo a ativo há dezenas de fatias finas, e o rótulo de cada uma se
      // amontoa no topo: só as que se leem ganham nome; o resto fica no tooltip.
      minOuterLabelPercentage={byCategory ? 1 : 4}
    />
  )
}
