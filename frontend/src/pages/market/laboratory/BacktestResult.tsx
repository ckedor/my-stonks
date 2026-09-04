import type { BacktestResult as BacktestResultPayload } from '@/api/lab'
import PortfolioReturnsChart, {
  type ReturnsChartExternalSeries,
} from '@/components/PortfolioReturnsChart'
import RiskAnalysisCards from '@/components/RiskAnalysisCards'
import {
  AppAlert,
  AppCard,
  AppMetric,
  AppSimpleTable,
  AppStack,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useMemo } from 'react'

/* O resultado de uma simulação.
 *
 * A análise vem do backend no mesmo formato que a carteira real entrega, e é
 * por isso que `RiskAnalysisCards` aparece aqui sem uma linha de adaptação: ele
 * recebe um `AssetAnalysis` por prop e não sabe de onde veio. Uma carteira que
 * ninguém comprou é lida com as mesmas métricas de uma que existe — que é o
 * ponto do laboratório. */

const money = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })

const percent = (value: number | null | undefined) =>
  value == null ? '—' : `${value.toFixed(1)}%`

const day = (value: string) => value.split('-').reverse().join('/')

/** Qual parte do resultado está aberta. Empilhá-las todas empurrava o risco
 *  para dois rolares abaixo da curva, onde ninguém chegava. */
export type ResultTab = 'performance' | 'risk' | 'composition'

interface Props {
  result: BacktestResultPayload
  tab: ResultTab
  benchmarks?: string[]
}

export default function BacktestResult({ result, tab, benchmarks }: Props) {
  const curve = useMemo<ReturnsChartExternalSeries[]>(
    () => [
      {
        key: 'lab',
        label: result.label || 'Carteira teórica',
        data: result.series.map((point) => ({
          date: point.date,
          value: point.acc_return,
        })),
      },
    ],
    [result],
  )
  const selectedCurve = useMemo(() => ['lab'], [])

  const cagr = result.analysis?.performance_metrics.cagr ?? null
  const cdi = result.analysis?.performance_metrics.benchmarks_metrics.CDI
  const overCdi = cagr != null && cdi && cdi.cagr !== 0 ? (cagr / cdi.cagr) * 100 : null

  const lineColumns: AppSimpleTableColumn<BacktestResultPayload['lines'][number]>[] = [
    { label: 'Linha', width: 'clamped', render: (line) => line.label },
    {
      label: 'Alvo',
      align: 'right',
      sortValue: (line) => line.target_weight,
      render: (line) => percent(line.target_weight),
    },
    {
      label: 'No fim',
      align: 'right',
      sortValue: (line) => line.final_weight,
      render: (line) => percent(line.final_weight),
    },
    {
      label: 'Valor',
      align: 'right',
      sortValue: (line) => line.final_value,
      render: (line) => money(line.final_value),
    },
  ]

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack direction="row" gap="lg" wrap>
          <AppMetric label="Patrimônio final" value={money(result.final_value)} />
          <AppMetric label="Investido" value={money(result.invested)} />
          <AppMetric
            label="Lucro"
            value={money(result.profit)}
            tone={result.profit >= 0 ? 'success' : 'danger'}
          />
          <AppMetric label="Retorno anualizado" value={percent(cagr)} />
          <AppMetric
            label="Do CDI"
            value={overCdi == null ? '—' : `${overCdi.toFixed(0)}%`}
            hint="O retorno anualizado da carteira sobre o do CDI no mesmo período."
          />
          <AppMetric
            label="Período"
            value={`${day(result.window.start_date)} — ${day(result.window.end_date)}`}
            hint={`${result.contributions} aportes · ${result.rebalances} rebalanceamentos`}
          />
        </AppStack>
      </AppCard>

      {result.window.limited_by && (
        <AppAlert severity="info">
          A simulação começou em {day(result.window.start_date)} porque é o primeiro
          dia em que <strong>{result.window.limited_by}</strong> já tinha preço. Uma
          janela maior pede uma linha mais antiga.
        </AppAlert>
      )}

      {tab === 'performance' && (
        <AppCard>
          <PortfolioReturnsChart
            size={420}
            externalSeries={curve}
            selectedExternalSeries={selectedCurve}
            selectedBenchmarks={benchmarks}
            persistKey="lab-backtest"
          />
        </AppCard>
      )}

      {tab === 'composition' && (
        <AppCard>
          <AppSimpleTable
            rows={result.lines}
            columns={lineColumns}
            getRowKey={(line) => line.key}
          />
        </AppCard>
      )}

      {tab === 'risk' &&
        (result.analysis ? (
          <RiskAnalysisCards analysis={result.analysis} showBenchmarks />
        ) : (
          <AppAlert severity="info">
            A janela simulada é curta demais para medir risco.
          </AppAlert>
        ))}
    </AppStack>
  )
}
