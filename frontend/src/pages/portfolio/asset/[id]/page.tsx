import { EMPTY_LIST } from '@/queries/empty'
import { usePositions, useSelectedPortfolio } from '@/queries/portfolio'
import AssetDetailPanel from '@/components/AssetDetailPanel'
import {
  AppBreadcrumbs,
  AppButton,
  AppListRow,
  AppSearchField,
  AppSideDrawer,
  AppStack,
  AppStackItem,
  AppText,
  SectionLabel,
} from '@/components/ui'
import type { PortfolioPositionEntry } from '@/types'
import SearchIcon from '@mui/icons-material/Search'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

function AssetSearchDrawer({
  positions,
  selectedAssetId,
}: {
  positions: PortfolioPositionEntry[]
  selectedAssetId: number
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const totalValue = useMemo(
    () => positions.reduce((sum, item) => sum + item.value, 0),
    [positions],
  )

  const filteredPositions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return positions

    return positions.filter((position) =>
      [position.ticker, position.name, position.category, position.type, position.class]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    )
  }, [positions, search])

  const grouped = useMemo(() => {
    const map: Record<string, PortfolioPositionEntry[]> = {}
    for (const position of filteredPositions) {
      const category = position.category || 'Sem categoria'
      if (!map[category]) map[category] = []
      map[category].push(position)
    }

    for (const category of Object.keys(map)) {
      map[category].sort((a, b) => b.value - a.value)
    }

    return Object.entries(map).sort(
      ([, a], [, b]) =>
        b.reduce((sum, position) => sum + position.value, 0) -
        a.reduce((sum, position) => sum + position.value, 0),
    )
  }, [filteredPositions])

  return (
    <>
      <AppButton emphasis="outline" size="sm" icon={<SearchIcon />} onClick={() => setOpen(true)}>
        Buscar ativo
      </AppButton>

      <AppSideDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Trocar ativo"
        width="sm"
        header={
          <AppSearchField
            label="Buscar ativo"
            hideLabel
            icon
            autoFocus
            placeholder="Buscar por ticker, nome ou categoria"
            value={search}
            onChange={setSearch}
          />
        }
      >
        <AppStack gap="md">
          {grouped.map(([category, assets]) => (
            <AppStack key={category} gap="xs">
              <SectionLabel>{category}</SectionLabel>
              {assets.map((asset) => (
                <AppListRow
                  key={asset.asset_id}
                  padding="sm"
                  selected={asset.asset_id === selectedAssetId}
                  onClick={() => {
                    navigate(`/portfolio/asset/${asset.asset_id}`)
                    setOpen(false)
                  }}
                >
                  <AppStack direction="row" gap="sm" align="center" grow>
                    <AppStackItem>
                      <AppText variant="bodySmall" weight="strong" noWrap>
                        {asset.ticker}
                      </AppText>
                      <AppText variant="caption" tone="secondary" noWrap>
                        {asset.name}
                      </AppText>
                    </AppStackItem>
                    <AppText variant="caption" tone="secondary">
                      {totalValue > 0 ? `${((asset.value / totalValue) * 100).toFixed(1)}%` : '0,0%'}
                    </AppText>
                  </AppStack>
                </AppListRow>
              ))}
            </AppStack>
          ))}

          {grouped.length === 0 && <AppText tone="secondary">Nenhum ativo encontrado.</AppText>}
        </AppStack>
      </AppSideDrawer>
    </>
  )
}

export default function PortfolioAssetPage() {
  const { id } = useParams<{ id: string }>()
  const selectedPortfolio = useSelectedPortfolio()
  const portfolioId = selectedPortfolio?.id
  const positions = usePositions().data ?? EMPTY_LIST
  const assetId = id ? parseInt(id, 10) : null
  const ticker = positions.find((p) => p.asset_id === assetId)?.ticker

  if (!portfolioId || !assetId) return null

  return (
    <AppStack gap="md">
      <AppBreadcrumbs
        items={[
          { label: 'Ativos', href: '/portfolio/asset' },
          { label: ticker ?? '' },
        ]}
      />

      <AssetDetailPanel
        assetId={assetId}
        portfolioId={portfolioId}
        assetSelector={<AssetSearchDrawer positions={positions} selectedAssetId={assetId} />}
      />
    </AppStack>
  )
}
