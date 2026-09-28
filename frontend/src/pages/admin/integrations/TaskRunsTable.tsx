import type { TaskRun } from '@/api/operations'
import {
  AppChip,
  AppSimpleTable,
  type AppSimpleTableColumn,
  AppStack,
  AppText,
} from '@/components/ui'

import {
  formatDuration,
  formatWhen,
  RUN_STATUS,
  TRIGGER_LABEL,
} from './operationsFormat'

/* Uma linha por execução de tarefa, a mais recente em cima. A tarefa aparece
 * sob o nome da rotina porque uma rotina tem mais de uma: a consolidação é
 * uma tarefa que dispara uma por carteira. */

function summary(run: TaskRun): string | null {
  if (run.error) return run.error
  const result = run.result
  if (result === null || result === undefined) return null
  if (typeof result === 'object') {
    return Object.entries(result as Record<string, unknown>)
      .filter(([, value]) => typeof value !== 'object')
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ')
  }
  return String(result)
}

const COLUMNS: AppSimpleTableColumn<TaskRun>[] = [
  { label: 'Início', render: (run) => formatWhen(run.started_at) },
  {
    label: 'Rotina',
    render: (run) => (
      <AppStack gap="none">
        <AppText variant="bodySmall" weight="strong">
          {run.routine_name ?? run.task_name}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {run.task_name}
        </AppText>
      </AppStack>
    ),
  },
  { label: 'Origem', render: (run) => TRIGGER_LABEL[run.trigger] },
  {
    label: 'Duração',
    align: 'right',
    render: (run) => (run.status === 'running' ? '…' : formatDuration(run.duration_seconds)),
  },
  {
    label: 'Situação',
    render: (run) => (
      <AppChip label={RUN_STATUS[run.status].label} tone={RUN_STATUS[run.status].tone} />
    ),
  },
  {
    label: 'Resultado',
    width: 'clamped',
    render: (run) => (
      <AppText variant="caption" tone={run.error ? 'danger' : 'secondary'}>
        {summary(run) ?? '—'}
      </AppText>
    ),
  },
]

export default function TaskRunsTable({
  runs,
  emptyMessage,
}: {
  runs: TaskRun[]
  emptyMessage: string
}) {
  return (
    <AppSimpleTable<TaskRun>
      columns={COLUMNS}
      rows={runs}
      getRowKey={(run) => run.id}
      emptyMessage={emptyMessage}
      surface="outlined"
    />
  )
}
