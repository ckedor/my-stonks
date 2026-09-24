import {
  AppButton,
  AppMetric,
  AppSelect,
  AppDivider,
  AppGrid,
  SectionTitle,
  AppSwitch,
  SectionLabel,
  AppSkeleton,
  AppStack,
  AppText,
  AppTreemap,
  useAppTheme,
  type AppTreemapGroup,
  type AppTreemapLeaf,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { PortfolioPositionEntry } from '@/types'
import { scaleLinear } from '@visx/scale'
import { lazy, Suspense, useMemo, useState } from 'react'

import type { DistributionMetric } from './PerformanceBarChart'

const AppTreemap3D = lazy(() => import('@/components/ui/AppTreemap3D'))

interface PortfolioHeatMapProps {
  mode?: '2d' | '3d'
  positions: PortfolioPositionEntry[]
  /** Métrica que pinta os blocos. `null` só vale no 3D: os prédios ficam com
   *  a cor da categoria, tirada de uma paleta de fachadas. */
  metric?: DistributionMetric | null
  onAssetSelect?: (assetId: number) => void
  /** Valor de cada ativo em reais, por `asset_id`, quando a moeda exibida é
   *  outra. A cidade 3D mede em reais; sem isto, usa o valor exibido. */
  valueInReais?: Map<number, number>
  /** Altura do mapa. O padrão é a tela inteira; uma tela que tem outro bloco
   *  abaixo dele passa uma altura fixa, senão o mapa toma a dobra sozinho e
   *  o resto nunca aparece sem rolar. */
  height?: number | string
}

const NO_CATEGORY = '(Sem categoria)'

/** Sozinho na tela, o mapa ocupa o que sobra abaixo da barra superior e do
 *  cabeçalho da página. Os 210px são a soma do que está acima dele, e mudaram
 *  quando o cabeçalho padrão trouxe o rastro de navegação — quem cobra a
 *  conta é o `expectNothingClipped` do e2e, que falha dizendo por quantos
 *  pixels. */
const FULL_SCREEN_HEIGHT = 'calc(100vh - 210px)'

/* Extremos da escala de cor, por métrica. Um lucro de cem mil e uma
   rentabilidade de 30% são o mesmo verde: é o teto de cada uma. */
const COLOR_DOMAIN: Record<DistributionMetric, number[]> = {
  profit: [-50000, 0, 100000],
  cagr: [-0.2, 0, 0.3],
  twelve_months_return: [-0.2, 0, 0.3],
  acc_return: [-0.2, 0, 0.3],
}

const COLOR_RANGE = ['rgb(206, 43, 43)', 'rgb(117, 117, 117)', 'rgb(39, 174, 96)']

/* Fachadas: arenito, ardósia, tijolo, calcário, pátina, aço, ocre, taupe.
   Sem métrica, a cor volta a dizer a categoria, que deixou de ser quarteirão. */
const BUILDING_PALETTE = ['#b9a58c', '#8f9aa6', '#a86f5a', '#cbc3b3', '#6f8174', '#7d8fa8', '#c49a6c', '#9c8a7a']

function getMetricValue(pos: PortfolioPositionEntry, metric: DistributionMetric): number {
  switch (metric) {
    case 'profit':
      return (pos.value ?? 0) - (pos.total_invested ?? 0)
    case 'cagr':
      return pos.cagr ?? 0
    case 'twelve_months_return':
      return pos.twelve_months_return ?? 0
    case 'acc_return':
      return pos.acc_return ?? 0
  }
}

function formatMetricDisplay(
  value: number,
  metric: DistributionMetric,
  fmtCurrency?: (v: number) => string,
): string {
  if (metric === 'profit') {
    return fmtCurrency ? fmtCurrency(value) : `R$ ${(value / 1000).toFixed(1)}k`
  }
  const pct = value * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

/** One year at the existing annualized rate, with no new contributions. */
function projectOneYear(position: PortfolioPositionEntry): number | null {
  if (position.cagr == null || !Number.isFinite(position.cagr) || position.cagr < -1) return null
  const projected = position.value * (1 + position.cagr)
  return Number.isFinite(projected) && projected >= 0 ? projected : null
}

export default function PortfolioHeatMap({
  positions,
  mode = '2d',
  metric = 'twelve_months_return',
  onAssetSelect,
  height = FULL_SCREEN_HEIGHT,
  valueInReais,
}: PortfolioHeatMapProps) {
  const theme = useAppTheme()
  const { currency, locale } = useCurrency()
  const formatCurrency = useMemo(() => new Intl.NumberFormat(locale, { style: 'currency', currency }).format, [locale, currency])
  const [showProjection, setShowProjection] = useState(false)
  /** Categoria em foco na cidade 3D; vazio é a carteira inteira. */
  const [focusedCategory, setFocusedCategory] = useState('')

  const total = positions.reduce((sum, p) => sum + p.value, 0)

  const colorScale = useMemo(
    () => metric ? scaleLinear<string>({ domain: COLOR_DOMAIN[metric], range: COLOR_RANGE, clamp: true }) : null,
    [metric],
  )

  /* Categorias em ordem de tamanho: a maior nasce no canto superior
     esquerdo, que é por onde se começa a ler. */
  const groups: AppTreemapGroup[] = useMemo(() => {
    const byCategory = positions.reduce<Record<string, PortfolioPositionEntry[]>>((acc, pos) => {
      const key = pos.category || NO_CATEGORY
      if (!acc[key]) acc[key] = []
      acc[key].push(pos)
      return acc
    }, {})

    const categoryTotal = (items: PortfolioPositionEntry[]) =>
      items.reduce((sum, pos) => sum + pos.value, 0)

    return Object.entries(byCategory)
      .sort(([, a], [, b]) => categoryTotal(b) - categoryTotal(a))
      .map(([category, items], index) => ({
        label: category,
        items: items.map((pos) => {
          const metricValue = metric ? getMetricValue(pos, metric) : 0
          // Size in reais; the projection is a ratio, so it scales along.
          const inReais = valueInReais?.get(pos.asset_id)
          const scale = inReais != null && pos.value > 0 ? inReais / pos.value : 1
          const projected = projectOneYear(pos)
          return {
            key: pos.asset_id,
            label: pos.ticker ?? pos.name,
            caption: metric ? formatMetricDisplay(metricValue, metric, formatCurrency) : undefined,
            value: pos.value * scale,
            valueDisplay: formatCurrency(pos.value),
            projectedValue: projected == null ? null : projected * scale,
            tint: colorScale ? colorScale(metricValue) : BUILDING_PALETTE[index % BUILDING_PALETTE.length],
          }
        }),
      }))
  }, [positions, metric, colorScale, formatCurrency, valueInReais])

  /* Uma categoria que sumiu da carteira não deixa a cidade vazia. */
  const focusedGroups = useMemo(() => {
    const focused = groups.filter(group => group.label === focusedCategory)
    return focused.length > 0 ? focused : groups
  }, [groups, focusedCategory])
  const focusedLabel = focusedGroups.length === 1 && focusedGroups !== groups ? focusedGroups[0].label : null
  const focusedTotal = focusedLabel
    ? positions.filter(pos => (pos.category || NO_CATEGORY) === focusedLabel).reduce((sum, pos) => sum + pos.value, 0)
    : total

  const renderTooltip = (leaf: AppTreemapLeaf) => {
    const pos = positions.find((item) => item.asset_id === leaf.key)
    if (!pos) return null

    const pct = total > 0 ? (pos.value / total) * 100 : 0
    const invested = pos.total_invested ?? 0

    return (
      <AppStack gap="xs">
        <AppText variant="caption" weight="strong">
          {pos.ticker ?? pos.name}
        </AppText>
        <AppText variant="caption">Valor: {formatCurrency(pos.value)}</AppText>
        <AppText variant="caption">Participação: {pct.toFixed(2)}%</AppText>
        {metric && <AppText variant="caption">
          {formatMetricDisplay(getMetricValue(pos, metric), metric, formatCurrency)}
        </AppText>}
        {invested > 0 && (
          <AppText variant="caption">Investido: {formatCurrency(invested)}</AppText>
        )}
      </AppStack>
    )
  }

  const renderSidebar = (leaf: AppTreemapLeaf | null) => {
    const pos = leaf ? positions.find(item => item.asset_id === leaf.key) : null
    const projected = pos ? projectOneYear(pos) : null
    const money = (value: number | null | undefined) => value != null && Number.isFinite(value) ? formatCurrency(value) : '—'
    const rate = (value: number | null | undefined) => value != null && Number.isFinite(value) ? formatMetricDisplay(value, 'cagr') : '—'
    const profit = pos && Number.isFinite(pos.total_invested) ? pos.value - pos.total_invested : null
    const rows = pos ? [
      { label: 'Investido', value: money(pos.total_invested) },
      { label: 'Lucro', value: money(profit), tone: profit == null || profit === 0 ? 'default' as const : profit > 0 ? 'success' as const : 'danger' as const },
      { label: 'Rentabilidade 12M', value: rate(pos.twelve_months_return) },
      { label: 'Acumulada', value: rate(pos.acc_return) },
      { label: 'CAGR', value: rate(pos.cagr) },
      { label: 'Quantidade', value: Number.isFinite(pos.quantity) ? pos.quantity.toLocaleString(locale, { maximumFractionDigits: 8 }) : '—' },
      { label: 'Preço médio', value: money(pos.average_price) },
    ] : []
    return <AppStack gap="md">
      <AppSelect
        label="Categoria"
        size="full"
        options={[{ value: '', label: 'Todas' }, ...groups.map(group => ({ value: group.label, label: group.label }))]}
        value={focusedLabel ?? ''}
        onChange={setFocusedCategory}
      />
      <AppStack gap="xs">
        <SectionTitle>{pos ? pos.ticker ?? pos.name : focusedLabel ?? 'Carteira'}</SectionTitle>
        {pos?.ticker && pos.name !== pos.ticker && <AppText variant="bodySmall" tone="secondary">{pos.name}</AppText>}
        {pos && <AppText variant="caption" tone="secondary">
          {[pos.category || NO_CATEGORY, pos.type].filter((value, index, items) => value && items.indexOf(value) === index).join(' · ')}
        </AppText>}
      </AppStack>
      <AppMetric label={pos ? 'Valor atual' : 'Patrimônio'} value={money(pos ? pos.value : focusedTotal)} size="lg" />
      <AppDivider />
      <AppStack gap="sm">
        <AppSwitch label="Projeção · 1 ano" checked={showProjection} onChange={setShowProjection} />
        {showProjection && pos && (projected == null
          ? <AppText variant="caption" tone="secondary">CAGR indisponível</AppText>
          : <AppGrid cols={2} gap="sm">
            <AppMetric label="Projetado" value={money(projected)} />
            <AppMetric label="Variação" value={money(projected - pos.value)} tone={projected >= pos.value ? 'success' : 'danger'} />
          </AppGrid>)}
      </AppStack>
      {pos ? <>
        <AppDivider />
        <AppStack gap="sm">
          <SectionLabel>Posição</SectionLabel>
          {rows.map(row => <AppStack key={row.label} direction="row" justify="between" align="baseline" gap="sm">
            <AppText variant="bodySmall" tone="secondary">{row.label}</AppText>
            <AppText variant="bodySmall" weight="strong" tone={row.tone ?? 'default'}>{row.value}</AppText>
          </AppStack>)}
        </AppStack>
        {onAssetSelect && <AppButton emphasis="outline" size="sm" fullWidth onClick={() => onAssetSelect(pos.asset_id)}>Abrir ativo</AppButton>}
      </> : <AppText variant="caption" tone="secondary">Nenhum ativo selecionado</AppText>}
    </AppStack>
  }

  const chartProps = {
    groups, height,
    onSelect: (key: string | number) => onAssetSelect?.(Number(key)),
    renderTooltip,
    backgroundColor: theme.palette.background.default,
    labelColor: theme.palette.text.primary,
  }
  return (
    <Suspense fallback={<AppSkeleton height={height} />}>
      {mode === '3d'
        ? <AppTreemap3D {...chartProps} groups={focusedGroups} showProjection={showProjection} renderSidebar={renderSidebar} />
        : <AppTreemap {...chartProps} />}
    </Suspense>
  )
}
