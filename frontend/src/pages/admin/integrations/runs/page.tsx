import { useState } from 'react'

import type { RoutineKey, TaskRunStatus } from '@/api/operations'
import {
  AppButton,
  AppPageHeader,
  AppSelect,
  AppStack,
  AppSwitch,
  AppTableSkeleton,
} from '@/components/ui'
import { EMPTY_LIST } from '@/queries/empty'
import { useOperationsDashboard, useTaskRuns } from '@/queries/operations'

import { RUN_STATUS } from '../operationsFormat'
import TaskRunsTable from '../TaskRunsTable'

/* Toda execução de tarefa que o worker registrou, a mais recente em cima.
 * O painel mostra a última de cada rotina; aqui está o histórico inteiro dos
 * últimos 45 dias, incluindo o que uma rotina disparou — a consolidação de
 * cada carteira, o recálculo de cada ativo. */

const ALL = 'all'
const LIMIT = 200

export default function AdminTaskRunsPage() {
  const { dashboard } = useOperationsDashboard()
  const [routine, setRoutine] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)
  const [includeChained, setIncludeChained] = useState(true)
  const { runs, loading, refreshing, refetch } = useTaskRuns({
    routine: routine === ALL ? undefined : (routine as RoutineKey),
    status: status === ALL ? undefined : (status as TaskRunStatus),
    includeChained,
    limit: LIMIT,
  })

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Execuções"
        description={`Cada tarefa que o worker rodou nos últimos 45 dias, com quem a disparou e como terminou. Mostra até ${LIMIT}.`}
        actions={
          <AppButton emphasis="outline" loading={refreshing} onClick={() => void refetch()}>
            Atualizar
          </AppButton>
        }
      />
      <AppStack direction="row" gap="md" align="center" wrap>
        <AppSelect
          label="Rotina"
          size="md"
          value={routine}
          onChange={setRoutine}
          options={[
            { value: ALL, label: 'Todas' },
            ...(dashboard?.routines ?? EMPTY_LIST).map((item) => ({
              value: item.key,
              label: item.name,
            })),
          ]}
        />
        <AppSelect
          label="Situação"
          value={status}
          onChange={setStatus}
          options={[
            { value: ALL, label: 'Todas' },
            ...(Object.keys(RUN_STATUS) as TaskRunStatus[]).map((value) => ({
              value,
              label: RUN_STATUS[value].label,
            })),
          ]}
        />
        <AppSwitch
          label="Incluir tarefas encadeadas"
          checked={includeChained}
          onChange={setIncludeChained}
        />
      </AppStack>
      {loading ? (
        <AppTableSkeleton columns={6} surface="card" />
      ) : (
        <TaskRunsTable runs={runs} emptyMessage="Nenhuma execução com esses filtros." />
      )}
    </AppStack>
  )
}
