import {
  fetchAssetTypeAnalysis,
  fetchAssetTypePatrimony,
  fetchAssetTypeReturns,
} from '@/api/portfolio'
import AssetCard from '@/components/portfolio-asset/AssetCard'
import {
  AppBreadcrumbs,
  AppButton,
  AppCard,
  AppDivider,
  AppGrid,
  AppGridItem,
  AppMetric,
  AppPieChart,
  AppStack,
  AppTabs,
  AppText,
  AppToggleGroup,
  LoadingSpinner,
  PageTitle,
  SectionTitle,
  useAppTheme,
} from '@/components/ui'
import { ASSET_TYPES } from '@/constants/assetTypes'
import { useCachedData } from '@/hooks/useCachedData'
import { useCurrency } from '@/hooks/useCurrency'
import { getLast12MonthDividendStats } from '@/lib/utils/dividends'
import { usePortfolioStore } from '@/stores/portfolio'
import { useDividendsStore } from '@/stores/portfolio/dividends'
import { usePositionsStore } from '@/stores/portfolio/positions'
import type { AssetAnalysis, FIIPortfolioPositionEntry, PatrimonyEntry, PortfolioReturnEntry } from '@/types'
import { useCallback, useMemo, useState } from 'react'
import FIIDividendsTab from './FIIDividendsTab'
import FIIReturnsTab from './FIIReturnsTab'
import FIIRiskTab from './FIIRiskTab'
import FIIWealthTab from './FIIWealthTab'
import {
  groupFIIConcentration,
  isFIIPosition,
  type FIIConcentrationDimension,
} from './summary'

const DIMENSIONS = [
  { value: 'type', label: 'Tipo', hint: 'Tijolo, papel, híbrido ou FOF' },
  { value: 'segment', label: 'Segmento', hint: 'Shopping, logística, lajes e outros' },
] satisfies Array<{
  value: FIIConcentrationDimension
  label: string
  hint: string
}>

type TabId = 'rentabilidade' | 'risco' | 'patrimonio' | 'proventos'

const TABS: { id: TabId; label: string }[] = [
  { id: 'rentabilidade', label: 'Rentabilidade' },
  { id: 'risco', label: 'Risco' },
  { id: 'patrimonio', label: 'Patrimônio' },
  { id: 'proventos', label: 'Proventos' },
]

const percent = (value: number) =>
  `${value >= 0 ? '+' : ''}${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`

export default function PortfolioFIIPage() {
  const portfolioId = usePortfolioStore((state) => state.selectedPortfolio?.id)
  const positions = usePositionsStore((state) => state.positions)
  const positionsLoading = usePositionsStore((state) => state.loading) && positions.length === 0
  const dividends = useDividendsStore((state) => state.dividends)
  const { currency, format: formatCurrency } = useCurrency()
  const theme = useAppTheme()

  const [dimension, setDimension] = useState<FIIConcentrationDimension>('type')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('rentabilidade')

  const fiiPositions = useMemo(
    () => positions.filter(isFIIPosition),
    [positions],
  )
  const fiiAssetIds = useMemo(
    () => new Set(fiiPositions.map((position) => position.asset_id)),
    [fiiPositions],
  )
  const fiiDividends = useMemo(
    () => dividends.filter((dividend) => fiiAssetIds.has(dividend.asset_id)),
    [dividends, fiiAssetIds],
  )

  const fetcher = useCallback(
    () => fetchAssetTypeReturns(portfolioId!, ASSET_TYPES.FII, currency),
    [portfolioId, currency],
  )
  const { data: typeReturns, loading: returnsLoading } = useCachedData<PortfolioReturnEntry[]>(
    portfolioId ? `asset-type-returns:${portfolioId}:${ASSET_TYPES.FII}:${currency}` : null,
    fetcher,
  )
  const returns = typeReturns ?? []

  const analysisFetcher = useCallback(
    () => fetchAssetTypeAnalysis(portfolioId!, ASSET_TYPES.FII, currency),
    [portfolioId, currency],
  )
  const { data: analysis, loading: analysisLoading } = useCachedData<AssetAnalysis | null>(
    portfolioId ? `asset-type-analysis:${portfolioId}:${ASSET_TYPES.FII}:${currency}` : null,
    analysisFetcher,
    { enabled: tab === 'risco' },
  )

  const patrimonyFetcher = useCallback(
    () => fetchAssetTypePatrimony(portfolioId!, ASSET_TYPES.FII, currency),
    [portfolioId, currency],
  )
  const { data: fiiPatrimony, loading: patrimonyLoading } = useCachedData<PatrimonyEntry[]>(
    portfolioId ? `asset-type-patrimony:${portfolioId}:${ASSET_TYPES.FII}:${currency}` : null,
    patrimonyFetcher,
    { enabled: tab === 'patrimonio' },
  )

  const concentration = useMemo(
    () => groupFIIConcentration(fiiPositions, dimension),
    [fiiPositions, dimension],
  )
  const visiblePositions = useMemo(() => {
    if (!selectedGroup) return fiiPositions
    return fiiPositions.filter((position) => {
      const value = dimension === 'type' ? position.fii_type : position.fii_segment
      return (value?.trim() || 'Não classificado') === selectedGroup
    })
  }, [fiiPositions, dimension, selectedGroup])

  if (positionsLoading) return <LoadingSpinner />

  const fiiValue = fiiPositions.reduce((sum, position) => sum + position.value, 0)
  const portfolioValue = positions.reduce((sum, position) => sum + position.value, 0)
  const portfolioWeight = portfolioValue > 0 ? (fiiValue / portfolioValue) * 100 : null
  const latestReturn = returns.at(-1)
  const dividend12m = getLast12MonthDividendStats(fiiDividends).total

  const changeDimension = (next: FIIConcentrationDimension) => {
    setDimension(next)
    setSelectedGroup(null)
  }

  return (
    <AppStack gap="lg">
      <AppStack gap="xs">
        <AppBreadcrumbs
          items={[
            { label: 'Carteira', href: '/portfolio/overview' },
            { label: 'FIIs' },
          ]}
        />
        <PageTitle>Fundos Imobiliários</PageTitle>
        <AppText variant="bodySmall" tone="secondary">
          Concentração e desempenho dos FIIs mantidos nesta carteira.
        </AppText>
      </AppStack>

      {fiiPositions.length === 0 ? (
        <AppCard>
          <AppText tone="secondary">Nenhum fundo imobiliário na posição atual.</AppText>
        </AppCard>
      ) : (
        <>
          <AppCard>
            <AppStack direction="row" gap="lg" wrap>
              <AppMetric label="Patrimônio em FIIs" value={formatCurrency(fiiValue)} size="lg" />
              <AppMetric
                label="Rentabilidade acumulada"
                value={latestReturn ? percent(latestReturn.acc_return * 100) : '—'}
                tone={latestReturn && latestReturn.acc_return < 0 ? 'danger' : 'success'}
              />
              <AppMetric
                label="CAGR"
                value={latestReturn?.cagr == null ? '—' : `${percent(latestReturn.cagr * 100)} a.a.`}
                tone={latestReturn?.cagr != null && latestReturn.cagr < 0 ? 'danger' : 'success'}
              />
              <AppMetric
                label="Peso na carteira"
                value={portfolioWeight == null ? '—' : `${portfolioWeight.toFixed(1).replace('.', ',')}%`}
              />
              <AppMetric label="Fundos" value={String(fiiPositions.length)} />
              <AppMetric label="Proventos em 12 meses" value={formatCurrency(dividend12m)} />
            </AppStack>
          </AppCard>

          <AppGrid cols={{ xs: 1, lg: 4 }} gap="lg" align="start">
            <AppGridItem>
              <AppCard>
                <AppStack gap="md">
                  <AppStack direction="row" align="center" justify="between" gap="sm" wrap>
                    <SectionTitle>Concentração</SectionTitle>
                    <AppToggleGroup
                      label="Dimensão da concentração"
                      options={DIMENSIONS}
                      value={dimension}
                      onChange={changeDimension}
                    />
                  </AppStack>
                  <AppPieChart
                    data={concentration}
                    height={300}
                    isCurrency
                    minOuterLabelPercentage={2}
                    onItemClick={(label) =>
                      setSelectedGroup((current) => (current === label ? null : label))
                    }
                  />
                </AppStack>
              </AppCard>
            </AppGridItem>

            <AppGridItem span={{ xs: 1, lg: 3 }}>
              <AppStack gap="md">
                <AppStack direction="row" align="center" justify="between" gap="sm" wrap>
                  <SectionTitle>
                    {selectedGroup ? `${selectedGroup} · ${visiblePositions.length}` : `Todos os FIIs · ${fiiPositions.length}`}
                  </SectionTitle>
                  {selectedGroup && (
                    <AppButton emphasis="ghost" size="sm" onClick={() => setSelectedGroup(null)}>
                      Limpar filtro
                    </AppButton>
                  )}
                </AppStack>

                <AppGrid cols={{ xs: 1, sm: 2, lg: 3 }} gap="md">
                  {visiblePositions.map((position: FIIPortfolioPositionEntry) => (
                    <AssetCard
                      key={position.asset_id}
                      position={position}
                      portfolioId={portfolioId!}
                      weight={fiiValue > 0 ? (position.value / fiiValue) * 100 : 0}
                      accentColor={theme.palette.primary.main}
                    />
                  ))}
                </AppGrid>
              </AppStack>
            </AppGridItem>
          </AppGrid>

          <AppDivider />

          <AppTabs items={TABS} value={tab} onChange={setTab} label="Visões dos FIIs" />

          {tab === 'rentabilidade' && (
            <FIIReturnsTab
              returns={returns}
              loading={returnsLoading}
              assetIds={[...fiiAssetIds]}
            />
          )}
          {tab === 'risco' && (
            <FIIRiskTab analysis={analysis} loading={analysisLoading} />
          )}
          {tab === 'patrimonio' && (
            <FIIWealthTab
              patrimony={fiiPatrimony ?? []}
              loading={patrimonyLoading}
              cagr={latestReturn?.cagr ?? null}
            />
          )}
          {tab === 'proventos' && <FIIDividendsTab dividends={fiiDividends} />}
        </>
      )}
    </AppStack>
  )
}
