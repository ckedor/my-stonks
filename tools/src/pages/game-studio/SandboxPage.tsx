import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  ASSET_BUILDING_TYPES, TOP_VALUE_USD, assetBuildingId, assetBuildingItem, assetBuildingItems, assetBuildingShape,
  assetBuildingVolume, clampValueUsd, formatValueUsd, normalizeTicker, parseAssetBuildingId,
  type AssetBuilding, type AssetBuildingType,
} from '@/components/city-game/asset-buildings'
import { cityBalance } from '@/components/city-game/economy'
import { ASSET_LAYOUT_REVISION, displacedAssets } from '@/components/city-game/layout'
import { CITY_MAP, CITY_MAP_SIZE } from '@/components/city-game/map'
import { TERRITORY_STAGES, territoryOf } from '@/components/city-game/territory'
import { cityTierStanding } from '@/components/city-game/tiers'
import {
  AppAlert, AppButton, AppCard, AppNumberField, AppSkeleton, AppStack,
  AppStackItem, AppSwitch, AppText, AppTextField, AppToggleGroup, PageTitle, SectionLabel, isoTerrainAvailability,
  type IsoBuilderPlacement, type IsoBuilderStatus,
} from '@/components/ui'
import { CATALOG_PATH } from '../navigation'
import { useGameSandboxStore } from './sandbox-store'
import { draftCatalog, useGameStudioStore, type MoneyMode } from './studio-store'

const AppIsoBuilder = lazy(() => import('@/components/ui/AppIsoBuilder'))

/** Lado do mapa, em casas. 512 × 512 são 262 144 casas: o custo de desenhar
 *  é o que está na tela, então o limite real é o que se consegue guardar e
 *  ordenar quando a cidade muda, não o tamanho do mapa. */
const MAP_SIZE = CITY_MAP_SIZE
const MAP_HEIGHT = 'max(560px, calc(100dvh - 330px))'
const volumeFormat = new Intl.NumberFormat('pt-BR')
const PRESETS = [100, 1_000, 10_000, 50_000, 100_000, 200_000]
const presetLabel = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' })
const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const priceLabel = (price: number) => presetLabel.format(price)

const MONEY_MODES: { value: MoneyMode; label: string }[] = [
  { value: 'unlimited', label: 'Infinito' },
  { value: 'player', label: 'Jogador' },
]

/** O mapa do jogo, para testar: o catálogo em rascunho, um prédio de ativo
 *  qualquer e o dinheiro que se quiser.
 *
 *  Com dinheiro infinito, tudo se compra e o mapa inteiro é território. Como
 *  jogador, o patrimônio simulado dá o saldo, a patente e o território, pelas
 *  mesmas contas do jogo (`economy.ts`, `tiers.ts`, `territory.ts`).
 *
 *  O prédio de ativo se escolhe aqui em cima e aparece na loja, em Ativos.
 *  O upgrade é o do jogo, simulado: um prédio no mapa com o mesmo tipo e
 *  ticker do escolhido, e menor que ele, oferece virar o escolhido. */
export default function SandboxPage() {
  const navigate = useNavigate()
  const { placements, pending, place, move, remove, clear, upgrade, placePending, replace, reconcileLayout, assetLayoutRevision } = useGameSandboxStore()
  const { edits, money, setMoney } = useGameStudioStore()
  const [draft, setDraft] = useState<Omit<AssetBuilding, 'valueUsd'>>({ type: 'FII', ticker: 'XPML11' })
  const edit = (change: Partial<AssetBuilding>) => setDraft(current => ({ ...current, ...change }))
  // O campo de valor pode ficar vazio enquanto se digita; o prédio usa o
  // valor dentro dos limites, e um ticker vazio ainda desenha um letreiro.
  const [value, setValue] = useState<number | null>(10_000)
  const building = useMemo<AssetBuilding>(
    () => ({ ...draft, ticker: draft.ticker || 'XPML11', valueUsd: clampValueUsd(value ?? 0) }),
    [draft, value],
  )

  const catalog = useMemo(() => draftCatalog(edits), [edits])
  const items = useMemo(() => {
    const chosen = assetBuildingId(building)
    return [...new Map([
      ...catalog,
      ...assetBuildingItems([...placements.map(placement => placement.item), ...pending, chosen]),
      assetBuildingItem(building),
    ].map(item => [item.id, item])).values()]
  }, [catalog, building, placements, pending])

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

  const player = money.mode === 'player'
  const balance = cityBalance(
    { patrimonyUsd: player ? money.patrimonyUsd : 0, dividendsUsd: player ? money.dividendsUsd : 0, bonusUsd: player ? money.bonusUsd : 0 },
    placements, itemsById,
  )
  const tier = cityTierStanding(money.patrimonyUsd)
  // Por patente, e não por render: o construtor guarda o que mediu de cada
  // área enquanto ela for o mesmo objeto.
  const rank = tier.current.rank
  const territory = useMemo(() => territoryOf(rank), [rank])
  const buildable = player && money.territory ? territory.buildable : undefined
  const pendingEdits = Object.keys(edits).length

  const status: IsoBuilderStatus = player
    ? {
      progress: {
        label: `Patente ${rank} · pelo patrimônio`,
        title: tier.current.name,
        value: tier.progress,
        lines: [
          `Patrimônio ${usd.format(money.patrimonyUsd)}`,
          ...(tier.next && tier.remainingUsd != null
            ? [`Faltam ${usd.format(tier.remainingUsd)} para ${tier.next.name}`]
            : ['O topo da escala']),
        ],
      },
      label: 'Dinheiro para construir',
      value: usd.format(balance.balanceUsd),
      tone: balance.balanceUsd < 0 ? 'danger' : 'default',
      rows: [
        { label: 'Patrimônio', value: usd.format(balance.patrimonyUsd) },
        { label: 'Dividendos recebidos', value: usd.format(balance.dividendsUsd) },
        { label: 'Bônus', value: `+${usd.format(balance.bonusUsd)}`, tone: 'success' },
        {
          label: 'Território',
          value: money.territory ? `${territory.opened.length} de ${TERRITORY_STAGES.length} áreas` : 'Mapa inteiro',
        },
        { label: 'Construído', value: balance.spentUsd ? `−${usd.format(balance.spentUsd)}` : usd.format(0) },
      ],
      note: balance.balanceUsd < 0 ? 'O que está construído passou do dinheiro: nada novo se compra.' : undefined,
    }
    : {
      label: 'Dinheiro para construir',
      value: 'Infinito',
      rows: [{ label: 'Construído', value: usd.format(balance.spentUsd) }],
    }

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

      {pendingEdits > 0 && (
        <AppAlert tone="info">
          <AppStack direction="row" align="center" justify="between" gap="sm" wrap>
            <span>
              O sandbox joga com o catálogo em rascunho: {pendingEdits} {pendingEdits === 1 ? 'peça mudada' : 'peças mudadas'}, sem salvar.
            </span>
            <AppButton size="sm" emphasis="ghost" onClick={() => navigate(CATALOG_PATH)}>Abrir o catálogo</AppButton>
          </AppStack>
        </AppAlert>
      )}

      <AppCard padding="sm">
        <AppStack direction="row" align="center" gap="md" wrap>
          <SectionLabel>Dinheiro</SectionLabel>
          <AppToggleGroup<MoneyMode>
            label="Dinheiro"
            options={MONEY_MODES}
            value={money.mode}
            onChange={mode => setMoney({ mode })}
          />
          {player ? (
            <>
              <AppNumberField
                label="Patrimônio" prefix="US$" size="md" min={0} step={1_000}
                value={money.patrimonyUsd} onChange={patrimonyUsd => setMoney({ patrimonyUsd })}
              />
              <AppNumberField
                label="Dividendos" prefix="US$" size="md" min={0} step={100}
                value={money.dividendsUsd} onChange={dividendsUsd => setMoney({ dividendsUsd })}
              />
              <AppNumberField
                label="Bônus" prefix="US$" size="md" min={0} step={100}
                value={money.bonusUsd} onChange={bonusUsd => setMoney({ bonusUsd })}
              />
              <AppSwitch
                label="Território da patente"
                checked={money.territory}
                onChange={checked => setMoney({ territory: checked })}
              />
              <AppText variant="bodySmall" tone="secondary">
                Patente {rank} · {tier.current.name} · saldo {usd.format(balance.balanceUsd)}
              </AppText>
            </>
          ) : (
            <AppText variant="bodySmall" tone="secondary">
              Tudo se compra, em qualquer parte do mapa. Os preços aparecem na loja.
            </AppText>
          )}
        </AppStack>
      </AppCard>

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
            label="Patrimônio no ativo"
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
          budget={player ? balance.balanceUsd : undefined}
          priceLabel={priceLabel}
          status={status}
          buildable={buildable}
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
