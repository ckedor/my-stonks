import type { BacktestResult, RunBacktest, TheoreticalPortfolio } from '@/api/lab'
import PortfolioReturnsChart, {
  type ReturnsChartExternalSeries,
} from '@/components/PortfolioReturnsChart'
import {
  AppButton,
  AppCard,
  AppEmptyState,
  AppGrid,
  AppGridItem,
  AppIconButton,
  AppListRow,
  AppPageHeader,
  AppPieChart,
  AppSideDrawer,
  AppSimpleTable,
  AppStack,
  AppTabs,
  AppText,
  SectionTitle,
  useAppTheme,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { EMPTY_LIST } from '@/queries/empty'
import {
  useCompareBacktests,
  useLabAssets,
  useLabSeries,
  useTheoreticalPortfolios,
} from '@/queries/lab'
import { useMemo, useState } from 'react'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CompositionPanel from '../CompositionPanel'
import LaboratorySkeleton from '../LaboratorySkeleton'
import SimulationForm from '../SimulationForm'
import {
  DEFAULT_YEARS,
  EMPTY_DRAFT,
  type DraftLine,
  type LabDraft,
} from '../useLaboratory'

/* Até quatro carteiras teóricas, na mesma janela e sob o mesmo regime.
 *
 * O regime é compartilhado de propósito: comparar carteiras com aportes
 * diferentes compara duas coisas ao mesmo tempo, e não se saberia qual delas
 * respondeu pela diferença. O que varia entre as colunas é só a alocação.
 *
 * A tela é a do Laboratório com outra escolha: lista à esquerda, simulação à
 * direita, resultado em abas. Roda pela mesma rota do painel de variações,
 * porque é a mesma leitura. */

/** Quatro é onde a leitura para de servir: são quatro curvas no mesmo gráfico
 *  e quatro colunas na tabela, e a quinta já não cabe na largura. */
const MAX_PORTFOLIOS = 4

/* Um concorrente é uma carteira salva **ou** um ativo solto.
 *
 * Sai de graça porque a rota de comparação recebe a alocação inteira no corpo
 * e não o id de uma carteira: um ativo avulso é uma alocação de uma linha com
 * 100%, e o backend não precisa saber a diferença. É o que deixa medir uma
 * carteira contra o IVV sem ter de salvar o IVV como carteira. */
type Competitor =
  | { kind: 'portfolio'; id: string; label: string; portfolio: TheoreticalPortfolio }
  | { kind: 'asset'; id: string; label: string; line: DraftLine }

type CompareTab = 'performance' | 'table' | 'allocation'

const money = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })

const percent = (value: number | null | undefined) =>
  value == null ? '—' : `${value.toFixed(1)}%`

interface MetricRow {
  label: string
  valueOf: (result: BacktestResult) => string
}

const METRIC_ROWS: MetricRow[] = [
  { label: 'Patrimônio final', valueOf: (item) => money(item.final_value) },
  { label: 'Investido', valueOf: (item) => money(item.invested) },
  { label: 'Lucro', valueOf: (item) => money(item.profit) },
  {
    label: 'Retorno anualizado',
    valueOf: (item) => percent(item.analysis?.performance_metrics.cagr),
  },
  {
    label: 'Volatilidade anual',
    valueOf: (item) => percent(item.analysis?.risk_metrics.annualized_vol),
  },
  {
    label: 'Sharpe',
    valueOf: (item) => item.analysis?.risk_metrics.sharpe_ratio?.toFixed(2) ?? '—',
  },
  {
    label: 'Pior queda',
    valueOf: (item) =>
      percent(
        item.analysis ? item.analysis.risk_metrics.drawdown.stats.max_drawdown * 100 : null,
      ),
  },
  {
    label: 'Alfa contra o CDI',
    valueOf: (item) =>
      percent(item.analysis?.performance_metrics.benchmarks_metrics.CDI?.alpha),
  },
]

export default function MarketLaboratoryComparePage() {
  const { portfolios, loading } = useTheoreticalPortfolios()
  const seriesList = useLabSeries()
  const compare = useCompareBacktests()
  const theme = useAppTheme()

  const assetList = useLabAssets()
  const [chosenIds, setChosenIds] = useState<number[]>([])
  const [adHoc, setAdHoc] = useState<DraftLine[]>([])
  const [toolsOpen, setToolsOpen] = useState(false)
  const [tab, setTab] = useState<CompareTab>('performance')
  const [settings, setSettings] = useState<LabDraft>({
    ...EMPTY_DRAFT,
    years: DEFAULT_YEARS,
  })

  const results = compare.data ?? EMPTY_LIST

  /* A ordem do clique é a ordem das colunas e das curvas: quem escolheu sabe
     qual carteira é a primeira sem ter de procurar a legenda. */
  const chosen = useMemo<Competitor[]>(() => {
    const saved = chosenIds
      .map((id) => portfolios.find((item: TheoreticalPortfolio) => item.id === id))
      .filter((item): item is TheoreticalPortfolio => item !== undefined)
      .map<Competitor>((portfolio) => ({
        kind: 'portfolio',
        id: `p${portfolio.id}`,
        label: portfolio.name,
        portfolio,
      }))
    const assets = adHoc.map<Competitor>((line) => ({
      kind: 'asset',
      id: line.key,
      label: line.label,
      line,
    }))
    return [...saved, ...assets]
  }, [chosenIds, portfolios, adHoc])

  const full = chosen.length >= MAX_PORTFOLIOS

  const toggle = (id: number) =>
    setChosenIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : full
          ? current
          : [...current, id],
    )

  const curves = useMemo<ReturnsChartExternalSeries[]>(
    () =>
      results.map((result, index) => ({
        key: `compare-${index}`,
        label: result.label ?? `Carteira ${index + 1}`,
        data: result.series.map((point) => ({ date: point.date, value: point.acc_return })),
        color: theme.palette.chart.colors[index % theme.palette.chart.colors.length],
      })),
    [results, theme],
  )
  const selectedCurves = useMemo(() => curves.map((curve) => curve.key), [curves])

  const run = () => {
    const runs: RunBacktest[] = chosen.map((competitor) => ({
      positions:
        competitor.kind === 'portfolio'
          ? competitor.portfolio.positions.map((position) => ({
              weight: position.weight,
              asset_id: position.asset_id,
              series_id: position.series_id,
              fixed_income_type_id: position.fixed_income_type_id,
              rate: position.rate,
              label: position.label,
            }))
          : [
              {
                weight: 100,
                asset_id: competitor.line.assetId,
                series_id: competitor.line.seriesId,
                fixed_income_type_id: competitor.line.fixedIncomeTypeId,
                rate: competitor.line.rate,
                label: competitor.line.label,
              },
            ],
      initial_amount: settings.initialAmount,
      contribution_amount: settings.contributionAmount,
      contribution_frequency: settings.contributionFrequency,
      rebalance_frequency: settings.rebalanceFrequency,
      years: settings.years,
      benchmark_ids: settings.benchmarkIds,
      label: competitor.label,
    }))
    compare.mutate(runs, { onSuccess: () => setTab('performance') })
  }

  const metricColumns: AppSimpleTableColumn<MetricRow>[] = [
    { label: 'Métrica', width: 'clamped', render: (row) => row.label },
    ...results.map((result, index) => ({
      label: result.label ?? `Carteira ${index + 1}`,
      align: 'right' as const,
      render: (row: MetricRow) => row.valueOf(result),
    })),
  ]

  if (loading) return <LaboratorySkeleton />

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Comparador"
        breadcrumbs={[
          { label: 'Mercado', href: '/market/overview' },
          { label: 'Laboratório', href: '/market/laboratory' },
          { label: 'Comparador' },
        ]}
        description="Até quatro carteiras teóricas na mesma janela e sob o mesmo regime."
      />

      {portfolios.length === 0 && adHoc.length === 0 ? (
        <AppEmptyState
          title="Nada para comparar ainda"
          description="Salve uma carteira no Laboratório, ou escolha um ativo aqui mesmo."
        />
      ) : (
        <>
          {results.length > 0 && (
            <AppTabs
              label="Partes da comparação"
              value={tab}
              onChange={setTab}
              items={[
                { id: 'performance', label: 'Rentabilidade' },
                { id: 'table', label: 'Lado a lado' },
                { id: 'allocation', label: 'Alocação' },
              ]}
            />
          )}

          {results.length === 0 && (
            <AppGrid cols={{ xs: 1, lg: 12 }} gap="lg">
              <AppGridItem span={{ xs: 1, lg: 7 }}>
                <AppStack gap="md">
                  <SectionTitle>O que comparar</SectionTitle>
                  {portfolios.length > 0 && (
                  <AppCard>
                    <AppStack gap="none">
                      {portfolios.map((item: TheoreticalPortfolio) => {
                        const order = chosenIds.indexOf(item.id)
                        return (
                          <AppListRow
                            key={item.id}
                            onClick={() => toggle(item.id)}
                            selected={order >= 0}
                          >
                            <AppStack grow gap="none">
                              <AppText>{item.name}</AppText>
                            </AppStack>
                            {order >= 0 && (
                              <AppText tone="secondary">{order + 1}º</AppText>
                            )}
                          </AppListRow>
                        )
                      })}
                    </AppStack>
                  </AppCard>
                  )}
                  {adHoc.length > 0 && (
                    <AppCard>
                      <AppStack gap="none">
                        {adHoc.map((line) => (
                          <AppListRow key={line.key} selected>
                            <AppStack grow gap="none">
                              <AppText>{line.label}</AppText>
                              <AppText variant="caption" tone="secondary">
                                Ativo solto
                              </AppText>
                            </AppStack>
                            <AppIconButton
                              label={`Remover ${line.label}`}
                              onClick={() =>
                                setAdHoc((current) =>
                                  current.filter((item) => item.key !== line.key),
                                )
                              }
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </AppIconButton>
                          </AppListRow>
                        ))}
                      </AppStack>
                    </AppCard>
                  )}

                  <AppStack direction="row" gap="sm" justify="between" align="center">
                    <AppText variant="caption" tone="secondary">
                      {chosen.length} de {MAX_PORTFOLIOS} escolhidas. A ordem é a
                      ordem das colunas.
                    </AppText>
                    <AppButton
                      emphasis="outline"
                      onClick={() => setToolsOpen(true)}
                      disabled={full}
                    >
                      <AddIcon fontSize="small" />
                      Adicionar ativo
                    </AppButton>
                  </AppStack>
                </AppStack>
              </AppGridItem>

              <AppGridItem span={{ xs: 1, lg: 5 }}>
                <AppStack gap="md">
                  <SectionTitle>Simulação</SectionTitle>
                  <AppCard>
                    <AppStack gap="md">
                      <SimulationForm
                        draft={settings}
                        series={seriesList}
                        onChange={(changes) =>
                          setSettings((current) => ({ ...current, ...changes }))
                        }
                      />
                      <AppStack direction="row" gap="sm" justify="end">
                        <AppButton
                          onClick={run}
                          loading={compare.isPending}
                          disabled={chosen.length < 2}
                        >
                          Comparar
                        </AppButton>
                      </AppStack>
                    </AppStack>
                  </AppCard>
                </AppStack>
              </AppGridItem>
            </AppGrid>
          )}

          {results.length > 0 && (
            <>
              <AppStack direction="row" gap="sm" justify="end">
                <AppButton emphasis="outline" onClick={() => compare.reset()}>
                  Escolher outras
                </AppButton>
                <AppButton onClick={run} loading={compare.isPending}>
                  Rodar de novo
                </AppButton>
              </AppStack>

              {tab === 'performance' && (
                <AppCard>
                  <PortfolioReturnsChart
                    size={420}
                    externalSeries={curves}
                    selectedExternalSeries={selectedCurves}
                    persistKey="lab-compare"
                  />
                </AppCard>
              )}

              {tab === 'table' && (
                <AppCard>
                  <AppSimpleTable
                    rows={METRIC_ROWS}
                    columns={metricColumns}
                    getRowKey={(row) => row.label}
                  />
                </AppCard>
              )}

              {tab === 'allocation' && (
                <AppGrid cols={{ xs: 1, sm: 2, lg: 4 }} gap="lg">
                  {chosen.map((competitor) => (
                    <AppGridItem key={competitor.id}>
                      <AppCard>
                        <AppStack gap="sm">
                          <AppText>{competitor.label}</AppText>
                          <AppPieChart
                            data={
                              competitor.kind === 'portfolio'
                                ? competitor.portfolio.positions
                                    .filter((position) => position.weight > 0)
                                    .map((position, line) => ({
                                      label: position.label ?? `Linha ${line + 1}`,
                                      value: position.weight,
                                    }))
                                : [{ label: competitor.label, value: 100 }]
                            }
                            height={200}
                            minOuterLabelPercentage={6}
                          />
                        </AppStack>
                      </AppCard>
                    </AppGridItem>
                  ))}
                </AppGrid>
              )}
            </>
          )}
        </>
      )}

      {/* O mesmo ferramental do Laboratório. Um ativo escolhido aqui vira um
          concorrente de uma linha só, e não uma carteira salva. */}
      <AppSideDrawer
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        title="Adicionar ativo"
        width="sm"
      >
        <CompositionPanel
          assets={assetList}
          series={seriesList}
          usedAssetIds={
            new Set(
              adHoc
                .map((line) => line.assetId)
                .filter((id): id is number => id !== null),
            )
          }
          onAdd={(line) => {
            setAdHoc((current) => [
              ...current,
              { ...line, key: `adhoc-${Date.now()}`, weight: 100 },
            ])
            setToolsOpen(false)
          }}
        />
      </AppSideDrawer>
    </AppStack>
  )
}
