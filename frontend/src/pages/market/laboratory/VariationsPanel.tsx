import type { BacktestResult, Frequency, RunBacktest } from '@/api/lab'
import {
  AppButton,
  AppSelect,
  AppSimpleTable,
  AppStack,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useState } from 'react'

/* A mesma carteira, com um parâmetro trocado.
 *
 * Roda pela mesma rota do comparador, porque é a mesma leitura: N corridas na
 * mesma janela, lidas lado a lado. O backend busca os preços uma vez para a
 * união das linhas, então variar rebalanceamento não custa uma segunda ida ao
 * banco. */

type Dimension = 'rebalance' | 'contribution'

const DIMENSION_OPTIONS = [
  { value: 'rebalance', label: 'Frequência de rebalanceamento' },
  { value: 'contribution', label: 'Frequência de aporte' },
]

const VARIED: { value: Frequency; label: string }[] = [
  { value: 'none', label: 'Nunca' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'annual', label: 'Anual' },
]

const percent = (value: number | null | undefined) =>
  value == null ? '—' : `${value.toFixed(1)}%`

const money = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })

interface Props {
  baseRun: RunBacktest | null
  results: BacktestResult[]
  running: boolean
  onRun: (runs: RunBacktest[]) => void
}

export default function VariationsPanel({ baseRun, results, running, onRun }: Props) {
  const [dimension, setDimension] = useState<Dimension>('rebalance')

  const run = () => {
    if (!baseRun) return
    onRun(
      VARIED.map((option) => ({
        ...baseRun,
        label: option.label,
        rebalance_frequency:
          dimension === 'rebalance' ? option.value : baseRun.rebalance_frequency,
        contribution_frequency:
          dimension === 'contribution' ? option.value : baseRun.contribution_frequency,
      })),
    )
  }

  const columns: AppSimpleTableColumn<BacktestResult>[] = [
    { label: 'Variação', width: 'clamped', render: (item) => item.label ?? '—' },
    {
      label: 'Patrimônio',
      align: 'right',
      sortValue: (item) => item.final_value,
      render: (item) => money(item.final_value),
    },
    {
      label: 'Anualizado',
      align: 'right',
      sortValue: (item) => item.analysis?.performance_metrics.cagr ?? 0,
      render: (item) => percent(item.analysis?.performance_metrics.cagr),
    },
    {
      label: 'Volatilidade',
      align: 'right',
      sortValue: (item) => item.analysis?.risk_metrics.annualized_vol ?? 0,
      render: (item) => percent(item.analysis?.risk_metrics.annualized_vol),
    },
    {
      label: 'Sharpe',
      align: 'right',
      sortValue: (item) => item.analysis?.risk_metrics.sharpe_ratio ?? 0,
      render: (item) => item.analysis?.risk_metrics.sharpe_ratio?.toFixed(2) ?? '—',
    },
    {
      label: 'Pior queda',
      align: 'right',
      sortValue: (item) => item.analysis?.risk_metrics.drawdown.stats.max_drawdown ?? 0,
      render: (item) =>
        percent(
          item.analysis
            ? item.analysis.risk_metrics.drawdown.stats.max_drawdown * 100
            : null,
        ),
    },
  ]

  return (
    <AppStack gap="md">
      <AppStack direction="row" gap="sm" wrap align="end">
        <AppSelect
          label="Variar"
          value={dimension}
          onChange={(value) => setDimension(value as Dimension)}
          options={DIMENSION_OPTIONS}
        />
        <AppButton onClick={run} disabled={!baseRun} loading={running}>
          Comparar variações
        </AppButton>
      </AppStack>

      {results.length === 0 ? (
        <AppText tone="secondary">
          Roda a mesma carteira quatro vezes, mudando só o parâmetro escolhido.
        </AppText>
      ) : (
        <AppSimpleTable
          rows={results}
          columns={columns}
          getRowKey={(item) => item.label ?? ''}
        />
      )}
    </AppStack>
  )
}
