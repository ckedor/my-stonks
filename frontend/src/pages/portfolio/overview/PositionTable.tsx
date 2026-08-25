import {
  AppCollapse,
  AppDivider,
  AppIconButton,
  AppListRow,
  AppStack,
  AppStackItem,
  AppText,
  MiniDonut,
  useAppTheme,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { usePortfolioStore } from '@/stores/portfolio'
import { useReturnsStore } from '@/stores/portfolio/returns'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useMemo, useState } from 'react'

interface Position {
  asset_id: number
  ticker: string
  category: string
  value: number
  acc_return: number
  cagr?: number | null
}

interface PositionTableProps {
  positions: Position[]
  selectedCategory?: string
  onCategorySelect?: (category: string) => void
  onAssetSelect?: (assetId: number) => void
}

/** Valor e retorno de uma linha, alinhados à direita. */
function RowFigures({ value, changePct }: { value: string; changePct: number | null }) {
  return (
    <AppStack align="end">
      <AppText variant="bodySmall" weight="strong">
        {value}
      </AppText>
      {changePct != null && (
        <AppText variant="caption" weight="strong" tone={changePct >= 0 ? 'success' : 'danger'}>
          {changePct >= 0 ? '+' : ''}
          {changePct.toFixed(2)}%
        </AppText>
      )}
    </AppStack>
  )
}

export default function PositionTable({
  positions,
  selectedCategory: controlledCategory,
  onCategorySelect,
  onAssetSelect,
}: PositionTableProps) {
  const [internalCategory, setInternalCategory] = useState<string>('portfolio')
  const selectedCategory = controlledCategory ?? internalCategory
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const selectedPortfolio = usePortfolioStore((s) => s.selectedPortfolio)
  const userCategories = selectedPortfolio?.custom_categories ?? []
  const categoryCagr = useReturnsStore((s) => s.categoryCagr)

  const theme = useAppTheme()

  const categoryColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const cat of userCategories) {
      map[cat.name] = cat.color
    }
    return map
  }, [userCategories])

  const data = useMemo(() => {
    const grouped: Record<string, { value: number; count: number; assets: Position[] }> = {}
    for (const pos of positions) {
      const categoryName = pos.category ?? '(Sem Categoria)'
      if (!grouped[categoryName]) grouped[categoryName] = { value: 0, count: 0, assets: [] }
      grouped[categoryName].value += pos.value
      grouped[categoryName].count += 1
      grouped[categoryName].assets.push(pos)
    }
    const total = Object.values(grouped).reduce((sum, v) => sum + v.value, 0)
    const rows = Object.entries(grouped)
      .map(([name, { value, count, assets }]) => ({
        category: name,
        value,
        count,
        percentage: total ? (value / total) * 100 : 0,
        returnAcc: categoryCagr[name] != null ? (categoryCagr[name] as number) * 100 : null,
        assets: assets.sort((a, b) => b.value - a.value),
      }))
      .sort((a, b) => b.value - a.value)
    return { rows, total }
  }, [positions, categoryCagr])

  const handleClick = (category: string) => {
    const next = category === selectedCategory ? 'portfolio' : category
    setInternalCategory(next)
    onCategorySelect?.(next)
  }

  const { format: fmt } = useCurrency()

  return (
    <AppStack>
      {data.rows.map((row, i) => {
        const color = categoryColorMap[row.category] ?? theme.palette.primary.main
        const expanded = expandedCategory === row.category
        return (
          <AppStack key={row.category}>
            <AppListRow
              selected={row.category === selectedCategory}
              onClick={() => handleClick(row.category)}
            >
              <AppStack direction="row" gap="sm" align="center" grow>
                <MiniDonut value={row.percentage} color={color} size={40} />
                <AppStackItem>
                  <AppText weight="strong">{row.category}</AppText>
                </AppStackItem>
                <RowFigures value={fmt(row.value)} changePct={row.returnAcc} />
                <AppIconButton
                  size="sm"
                  label={expanded ? 'Recolher categoria' : 'Expandir categoria'}
                  onClick={(event) => {
                    event.stopPropagation()
                    setExpandedCategory(expanded ? null : row.category)
                  }}
                >
                  {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                </AppIconButton>
              </AppStack>
            </AppListRow>

            <AppCollapse open={expanded}>
              <AppStack>
                {row.assets.map((asset) => {
                  const assetPct = data.total ? (asset.value / data.total) * 100 : 0
                  const assetCagr = asset.cagr != null ? asset.cagr * 100 : null
                  return (
                    <AppListRow
                      key={asset.asset_id}
                      padding="sm"
                      onClick={() => onAssetSelect?.(asset.asset_id)}
                    >
                      <AppStack direction="row" gap="sm" align="center" grow>
                        <MiniDonut value={assetPct} color={color} />
                        <AppStackItem>
                          <AppText variant="bodySmall" weight="strong">
                            {asset.ticker}
                          </AppText>
                        </AppStackItem>
                        <RowFigures value={fmt(asset.value)} changePct={assetCagr} />
                      </AppStack>
                    </AppListRow>
                  )
                })}
              </AppStack>
            </AppCollapse>

            {i < data.rows.length - 1 && <AppDivider />}
          </AppStack>
        )
      })}
    </AppStack>
  )
}
