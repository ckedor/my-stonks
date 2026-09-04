import AssetCard from '@/components/portfolio-asset/AssetCard'
import type { ReturnsChartExternalSeries } from '@/components/PortfolioReturnsChart'
import {
  AppButton,
  AppCard,
  AppDivider,
  AppGrid,
  AppGridItem,
  AppMetric,
  AppPageHeader,
  AppPieChart,
  AppStack,
  AppTabs,
  AppText,
  AppToggleGroup,
  SectionTitle,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { getLast12MonthDividendStats } from '@/lib/utils/dividends'
import type {
  AssetAnalysis,
  Dividend,
  PatrimonyEntry,
  PortfolioPositionEntry,
  ReturnsEntry,
  Trade,
} from '@/types'
import { useMemo, useState, type ReactNode } from 'react'
import {
  groupConcentration,
  positionsInGroup,
  type ConcentrationDimension,
} from './concentration'
import SliceDividendsTab from './SliceDividendsTab'
import SegmentDistributionTab from './SegmentDistributionTab'
import SliceDistributionTab from './SliceDistributionTab'
import SliceReturnsTab from './SliceReturnsTab'
import SliceRiskTab from './SliceRiskTab'
import SliceTradesTab from './SliceTradesTab'
import SliceWealthTab from './SliceWealthTab'
import { SLICE_TABS, type SliceTabId } from './tabs'

/* A tela de um recorte da carteira.
 *
 * Um recorte é um pedaço nomeado da carteira que uma tela inteira é sobre:
 * hoje uma categoria personalizada ou um segmento por tipo de ativo. O que
 * muda entre eles é só como o pedaço é escolhido — tudo que se lê sobre ele,
 * da concentração ao rebalanceamento, é a mesma leitura. Por isso é uma tela
 * só, e por isso o agrupamento entra por prop. */

const CONCENTRATION_HEIGHT = 300

/** Abaixo disto a fatia não cabe o próprio rótulo do lado de fora. */
const MIN_OUTER_LABEL_PERCENTAGE = 2

const percent = (value: number) =>
  `${value >= 0 ? '+' : ''}${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`

export interface PortfolioSliceScreenProps {
  portfolioId: number
  /** O nome do recorte, que é o rótulo dele na navegação. */
  title: string
  breadcrumbs: { label: string; href?: string }[]
  description?: string
  /** O que vai no canto do cabeçalho — o seletor de categoria, por exemplo. */
  actions?: ReactNode
  /** A cor que identifica o recorte: o anel de peso e o realce dos cards. */
  accentColor: string
  /** Prefixo das chaves com que os gráficos lembram período e janela. */
  persistKey: string

  /** As posições do recorte. */
  positions: PortfolioPositionEntry[]
  /** O patrimônio da carteira inteira: o peso do recorte só existe contra ele. */
  portfolioValue: number
  /** Por quais dimensões a concentração deste recorte pode ser lida. */
  dimensions: ConcentrationDimension[]
  /** Como o recorte se chama quando ele está vazio. */
  emptyMessage: string

  /** Rentabilidade acumulada do recorte. */
  returns: ReturnsEntry[]
  returnsLoading?: boolean
  benchmarks: string[]
  /** Quando a série já vive no store sob o nome de uma categoria. */
  categoryName?: string
  /** Quando ela vem de fora do store — o caso dos segmentos. */
  externalSeries?: ReturnsChartExternalSeries
  cagr: number | null

  analysis: AssetAnalysis | null
  analysisLoading: boolean

  patrimony: PatrimonyEntry[]
  patrimonyLoading?: boolean
  /** A coluna da evolução patrimonial que é este recorte. */
  patrimonySeriesKey: string
  /** Verdadeiro quando a resposta já vem recortada e a série é `portfolio`. */
  patrimonyFromPortfolioColumn?: boolean

  /** Os proventos da carteira inteira: o recorte sai daqui pelos ativos dele. */
  allDividends: Dividend[]
  /** A série que o gráfico de proventos desenha. */
  dividendsChartSelection: string
  /** As operações da carteira inteira, recortadas do mesmo jeito. */
  allTrades: Trade[]

  tab: SliceTabId
  onTabChange: (tab: SliceTabId) => void
}

export default function PortfolioSliceScreen(props: PortfolioSliceScreenProps) {
  const {
    portfolioId,
    positions,
    portfolioValue,
    dimensions,
    accentColor,
    persistKey,
    tab,
    onTabChange,
  } = props

  const { format: formatCurrency } = useCurrency()
  const [dimensionValue, setDimensionValue] = useState(dimensions[0].value)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  const dimension =
    dimensions.find((item) => item.value === dimensionValue) ?? dimensions[0]

  const assetIds = useMemo(
    () => new Set(positions.map((position) => position.asset_id)),
    [positions],
  )
  const dividends = useMemo(
    () => props.allDividends.filter((dividend) => assetIds.has(dividend.asset_id)),
    [props.allDividends, assetIds],
  )
  const trades = useMemo(
    () => props.allTrades.filter((trade) => assetIds.has(trade.asset_id)),
    [props.allTrades, assetIds],
  )
  /* O alvo é da categoria, então o recorte diz quais categorias entram na aba
     de rebalanceamento — nunca meia categoria. */
  const categoryNames = useMemo(
    () => [...new Set(positions.map((position) => position.category).filter(Boolean))],
    [positions],
  )

  const concentration = useMemo(
    () => groupConcentration(positions, dimension),
    [positions, dimension],
  )
  /* O filtro só vale enquanto a fatia clicada existir. Trocar de dimensão, de
     segmento ou de categoria com a mesma tela montada deixaria um filtro para
     trás e a lista de ativos apareceria vazia sem dizer por quê. */
  const activeGroup =
    selectedGroup && concentration.some((entry) => entry.label === selectedGroup)
      ? selectedGroup
      : null
  const visiblePositions = useMemo(
    () => (activeGroup ? positionsInGroup(positions, dimension, activeGroup) : positions),
    [positions, dimension, activeGroup],
  )

  const sliceValue = positions.reduce((sum, position) => sum + position.value, 0)
  const weight = portfolioValue > 0 ? (sliceValue / portfolioValue) * 100 : null
  const accReturn = props.returns.at(-1)?.value ?? null
  const dividend12m = getLast12MonthDividendStats(dividends).total

  const changeDimension = (next: string) => {
    setDimensionValue(next)
    setSelectedGroup(null)
  }

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title={props.title}
        breadcrumbs={props.breadcrumbs}
        description={props.description}
        actions={props.actions}
        metrics={
          positions.length === 0 ? undefined : (
            <>
              <AppMetric label="Patrimônio" value={formatCurrency(sliceValue)} size="lg" />
              <AppMetric
                label="Rentabilidade acumulada"
                value={accReturn == null ? '—' : percent(accReturn * 100)}
                tone={accReturn != null && accReturn < 0 ? 'danger' : 'success'}
              />
              <AppMetric
                label="CAGR"
                value={props.cagr == null ? '—' : `${percent(props.cagr * 100)} a.a.`}
                tone={props.cagr != null && props.cagr < 0 ? 'danger' : 'success'}
              />
              <AppMetric
                label="Peso na carteira"
                value={weight == null ? '—' : `${weight.toFixed(1).replace('.', ',')}%`}
              />
              <AppMetric label="Ativos" value={String(positions.length)} />
              <AppMetric label="Proventos em 12 meses" value={formatCurrency(dividend12m)} />
            </>
          )
        }
      />

      {positions.length === 0 ? (
        <AppCard>
          <AppText tone="secondary">{props.emptyMessage}</AppText>
        </AppCard>
      ) : (
        <>
          <AppGrid cols={{ xs: 1, lg: 4 }} gap="lg" align="start">
            <AppGridItem>
              <AppCard>
                <AppStack gap="md">
                  <AppStack direction="row" align="center" justify="between" gap="sm" wrap>
                    <SectionTitle>Concentração</SectionTitle>
                    <AppToggleGroup
                      label="Dimensão da concentração"
                      options={dimensions.map((item) => ({
                        value: item.value,
                        label: item.label,
                        hint: item.hint,
                      }))}
                      value={dimension.value}
                      onChange={changeDimension}
                    />
                  </AppStack>
                  <AppPieChart
                    data={concentration}
                    height={CONCENTRATION_HEIGHT}
                    isCurrency
                    minOuterLabelPercentage={MIN_OUTER_LABEL_PERCENTAGE}
                    onItemClick={(label) =>
                      setSelectedGroup((current) => (current === label ? null : label))
                    }
                  />
                </AppStack>
              </AppCard>
            </AppGridItem>

            <AppGridItem span={{ xs: 1, lg: 3 }}>
              <AppStack gap="md">
                {activeGroup && (
                  <AppStack direction="row" align="center" justify="between" gap="sm" wrap>
                    <SectionTitle>{`${activeGroup} · ${visiblePositions.length}`}</SectionTitle>
                    <AppButton emphasis="ghost" size="sm" onClick={() => setSelectedGroup(null)}>
                      Limpar filtro
                    </AppButton>
                  </AppStack>
                )}

                <AppGrid cols={{ xs: 1, sm: 2, lg: 3 }} gap="md">
                  {visiblePositions.map((position) => (
                    <AssetCard
                      key={position.asset_id}
                      position={position}
                      portfolioId={portfolioId}
                      weight={sliceValue > 0 ? (position.value / sliceValue) * 100 : 0}
                      accentColor={accentColor}
                    />
                  ))}
                </AppGrid>
              </AppStack>
            </AppGridItem>
          </AppGrid>

          <AppDivider />

          <AppTabs items={SLICE_TABS} value={tab} onChange={onTabChange} label="Visões do recorte" />

          {tab === 'rentabilidade' && (
            <SliceReturnsTab
              returns={props.returns}
              loading={props.returnsLoading}
              benchmarks={props.benchmarks}
              categoryName={props.categoryName}
              externalSeries={props.externalSeries}
              persistKey={`${persistKey}-returns`}
            />
          )}
          {tab === 'risco' && (
            <SliceRiskTab analysis={props.analysis} loading={props.analysisLoading} />
          )}
          {tab === 'patrimonio' && (
            <SliceWealthTab
              patrimony={props.patrimony}
              loading={props.patrimonyLoading}
              seriesKey={props.patrimonySeriesKey}
              fromPortfolioColumn={props.patrimonyFromPortfolioColumn}
              cagr={props.cagr}
              persistKey={`${persistKey}-patrimony`}
            />
          )}
          {tab === 'proventos' && (
            <SliceDividendsTab
              dividends={dividends}
              allDividends={props.allDividends}
              chartSelection={props.dividendsChartSelection}
            />
          )}
          {tab === 'trades' && <SliceTradesTab trades={trades} />}
          {/* O alvo pertence à categoria personalizada. Um segmento atravessa
              várias delas, então ali a aba mostra a repartição interna em vez
              do alvo de categorias que o recorte apenas toca. */}
          {tab === 'distribuicao' &&
            (props.categoryName === undefined ? (
              <SegmentDistributionTab positions={positions} />
            ) : (
              <SliceDistributionTab portfolioId={portfolioId} categoryNames={categoryNames} />
            ))}
        </>
      )}
    </AppStack>
  )
}
