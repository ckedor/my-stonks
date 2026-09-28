import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'

import {
  ASSET_BUILDING_TYPES, TOP_VALUE_USD, assetBuildingId, assetBuildingItem, assetBuildingItems, assetBuildingShape,
  assetBuildingVolume, clampValueUsd, formatValueUsd, normalizeTicker, parseAssetBuildingId,
  type AssetBuilding, type AssetBuildingType,
} from '@/components/city-game/asset-buildings'
import { CITY_CATALOG } from '@/components/city-game/catalog'
import { ASSET_LAYOUT_REVISION, displacedAssets } from '@/components/city-game/layout'
import { CITY_MAP, CITY_MAP_SIZE } from '@/components/city-game/map'
import {
  AppButton, AppCard, AppNumberField, AppSkeleton, AppStack,
  AppStackItem, AppText, AppTextField, AppToggleGroup, PageTitle, SectionLabel, isoTerrainAvailability,
  type IsoBuilderPlacement,
} from '@/components/ui'
import { useGameSandboxStore } from '@/stores/game-sandbox'

const AppIsoBuilder = lazy(() => import('@/components/ui/AppIsoBuilder'))

/** Lado do mapa, em casas. 512 × 512 são 262 144 casas: o custo de desenhar
 *  é o que está na tela, então o limite real é o que se consegue guardar e
 *  ordenar quando a cidade muda, não o tamanho do mapa. */
const MAP_SIZE = CITY_MAP_SIZE
const MAP_HEIGHT = 'max(560px, calc(100dvh - 250px))'
const volumeFormat = new Intl.NumberFormat('pt-BR')
const PRESETS = [100, 1_000, 10_000, 50_000, 100_000, 200_000]
const presetLabel = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' })

/** Um mapa fixo: continente, ilha central e três ilhas menores.
 *
 *  O prédio de ativo se escolhe aqui em cima e aparece na loja, em Ativos.
 *  O upgrade é o do jogo, simulado: um prédio no mapa com o mesmo tipo e
 *  ticker do escolhido, e menor que ele, oferece virar o escolhido. */
export default function GameSandboxPage() {
  const { placements, pending, place, move, remove, clear, upgrade, placePending, replace, reconcileLayout, assetLayoutRevision } = useGameSandboxStore()
  const [draft, setDraft] = useState<Omit<AssetBuilding, 'valueUsd'>>({ type: 'FII', ticker: 'XPML11' })
  const edit = (change: Partial<AssetBuilding>) => setDraft(current => ({ ...current, ...change }))
  // O campo de valor pode ficar vazio enquanto se digita; o prédio usa o
  // valor dentro dos limites, e um ticker vazio ainda desenha um letreiro.
  const [value, setValue] = useState<number | null>(10_000)
  const building = useMemo<AssetBuilding>(
    () => ({ ...draft, ticker: draft.ticker || 'XPML11', valueUsd: clampValueUsd(value ?? 0) }),
    [draft, value],
  )

  const items = useMemo(() => {
    const chosen = assetBuildingId(building)
    return [...new Map([
      ...CITY_CATALOG,
      ...assetBuildingItems([...placements.map(placement => placement.item), ...pending, chosen]),
      assetBuildingItem(building),
    ].map(item => [item.id, item])).values()]
  }, [building, placements, pending])

  const itemsById = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  const isLand = useMemo(() => isoTerrainAvailability(CITY_MAP, MAP_SIZE), [])
  useEffect(() => {
    if (assetLayoutRevision >= ASSET_LAYOUT_REVISION) return
    reconcileLayout(ASSET_LAYOUT_REVISION, displacedAssets(placements, itemsById, MAP_SIZE, isLand))
  }, [assetLayoutRevision, reconcileLayout, placements, itemsById, isLand])

  const upgradeOf = (placement: IsoBuilderPlacement) => {
    const current = parseAssetBuildingId(placement.item)
    if (!current || current.type !== building.type || current.ticker !== building.ticker) return null
    if (assetBuildingVolume(building) <= assetBuildingVolume(current)) return null
    return { item: assetBuildingId({ ...building, material: current.material }), label: `Upgrade: ${formatValueUsd(building.valueUsd)}` }
  }
  const shape = assetBuildingShape(building)

  return (
    <AppStack gap="md">
      <AppStack direction="row" justify="between" align="center" gap="sm" wrap>
        <AppStack gap="none">
          <PageTitle>Sandbox</PageTitle>
          <AppText variant="bodySmall" tone="secondary">
            {MAP_SIZE} × {MAP_SIZE} casas · {placements.length} peças
          </AppText>
        </AppStack>
        <AppButton size="sm" emphasis="outline" icon={<DeleteSweepIcon />} disabled={placements.length === 0 && pending.length === 0} onClick={clear}>
          Limpar mapa
        </AppButton>
      </AppStack>

      <AppCard padding="sm">
        <AppStack direction="row" align="center" gap="md" wrap>
          <SectionLabel>Escultura do ativo</SectionLabel>
          <AppToggleGroup<AssetBuildingType>
            label="Tipo de ativo"
            options={ASSET_BUILDING_TYPES}
            value={building.type}
            onChange={type => edit({ type })}
          />
          <AppNumberField
            label="Patrimônio"
            prefix="US$"
            size="md"
            min={0}
            step={100}
            allowEmpty
            value={value}
            onChange={setValue}
            error={(value ?? 0) > TOP_VALUE_USD}
            helperText={(value ?? 0) > TOP_VALUE_USD ? `Máximo ${formatValueUsd(TOP_VALUE_USD)}` : undefined}
          />
          <AppStack direction="row" gap="xs" wrap>
            {PRESETS.map(preset => (
              <AppButton key={preset} size="sm" emphasis={value === preset ? 'solid' : 'ghost'} onClick={() => setValue(preset)}>
                {presetLabel.format(preset)}
              </AppButton>
            ))}
          </AppStack>
          <AppStackItem grow={0} width={128}>
            <AppTextField
              label="Ticker"
              density="compact"
              value={draft.ticker}
              onChange={ticker => edit({ ticker: normalizeTicker(ticker) })}
            />
          </AppStackItem>
          <AppText variant="bodySmall" tone="secondary">
            Lote {shape.width}×{shape.depth} · {volumeFormat.format(Math.round(assetBuildingVolume(building)))} m³
            {' '}· teto {formatValueUsd(TOP_VALUE_USD)} · na loja, em Ativos
          </AppText>
        </AppStack>
      </AppCard>

      <Suspense fallback={<AppSkeleton height={MAP_HEIGHT} />}>
        <AppIsoBuilder
          items={items}
          placements={placements}
          size={MAP_SIZE}
          height={MAP_HEIGHT}
          terrain={CITY_MAP}
          boundless
          onPlace={place}
          onMove={move}
          onRemove={remove}
          onReplace={replace}
          upgradeOf={upgradeOf}
          onUpgrade={upgrade}
          pending={pending}
          onPlacePending={placePending}
        />
      </Suspense>
    </AppStack>
  )
}
