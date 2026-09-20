import { useState } from 'react'

import type { AiRun, AiUsageRow } from '@/api/ai'
import {
  AppChip,
  AppMetric,
  AppToggleGroup,
  AppSimpleTable,
  type AppSimpleTableColumn,
  AppStack,
  AppText,
  PageTitle,
  SectionTitle,
} from '@/components/ui'
import { useAiRuns, useAiUsage } from '@/queries/ai'
import CrudPageSkeleton from '../CrudPageSkeleton'

/* Quanto a IA custou, lido das mesmas linhas que registraram o gasto.
 *
 * Não há cache na frente disto e nem uma segunda fonte atrás: cada chamada a
 * um provedor grava uma linha na fronteira do provider, então o razão é
 * completo por construção — e não por alguém ter lembrado de instrumentar cada
 * chamador. É por isso que a extração de carteira recomendada, que não é uma
 * feature registrada, aparece aqui do mesmo jeito. */

const WINDOWS = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
]

const money = (value: number) => `US$ ${value.toFixed(4)}`

export default function AdminAiUsagePage() {
  const [days, setDays] = useState('30')
  const { usage, loading } = useAiUsage(Number(days))
  const { runs } = useAiRuns(50)

  const total = usage.reduce((sum: number, row: AiUsageRow) => sum + row.cost_usd, 0)
  const calls = usage.reduce((sum: number, row: AiUsageRow) => sum + row.runs, 0)

  const usageColumns: AppSimpleTableColumn<AiUsageRow>[] = [
    { label: 'Dia', render: (row) => new Date(row.day).toLocaleDateString('pt-BR') },
    { label: 'Funcionalidade', render: (row) => row.label },
    { label: 'Modelo', render: (row) => row.model },
    { label: 'Chamadas', align: 'right', render: (row) => String(row.runs) },
    { label: 'Tokens entrada', align: 'right', render: (row) => String(row.input_tokens) },
    { label: 'Tokens saída', align: 'right', render: (row) => String(row.output_tokens) },
    { label: 'Custo', align: 'right', render: (row) => money(row.cost_usd) },
  ]

  const runColumns: AppSimpleTableColumn<AiRun>[] = [
    { label: 'Quando', render: (run) => new Date(run.created_at).toLocaleString('pt-BR') },
    { label: 'Funcionalidade', render: (run) => run.label },
    { label: 'Provedor', render: (run) => run.provider },
    { label: 'Modelo', render: (run) => run.model },
    {
      label: 'Status',
      render: (run) => (
        <AppChip
          label={run.status === 'success' ? 'ok' : 'falhou'}
          tone={run.status === 'success' ? 'success' : 'danger'}
        />
      ),
    },
    { label: 'Latência', align: 'right', render: (run) => `${run.latency_ms} ms` },
    { label: 'Custo', align: 'right', render: (run) => money(run.cost_usd) },
    { label: 'Erro', render: (run) => run.error ?? '' },
  ]

  if (loading) return <CrudPageSkeleton columns={7} action={false} search={false} rows={6} />

  return (
    <AppStack gap="lg">
      <PageTitle>Uso e custo de IA</PageTitle>

      <AppToggleGroup label="Período" value={days} onChange={setDays} options={WINDOWS} />

      <AppStack direction="row" gap="lg" wrap>
        <AppMetric label="Custo no período" size="lg" value={money(total)} />
        <AppMetric label="Chamadas" size="lg" value={String(calls)} />
      </AppStack>

      <SectionTitle>Por dia</SectionTitle>
      <AppSimpleTable<AiUsageRow>
        columns={usageColumns}
        rows={usage}
        getRowKey={(row) => `${row.day}-${row.label}-${row.model}`}
        emptyMessage="Nenhuma chamada no período."
      />

      <SectionTitle>Últimas execuções</SectionTitle>
      <AppSimpleTable<AiRun>
        columns={runColumns}
        rows={runs}
        getRowKey={(run) => `${run.created_at}-${run.label}`}
        emptyMessage="Nenhuma execução registrada."
      />

      <AppText variant="caption" tone="secondary">
        Toda chamada a um provedor é registrada, inclusive as que não pertencem a uma funcionalidade
        cadastrada.
      </AppText>
    </AppStack>
  )
}
