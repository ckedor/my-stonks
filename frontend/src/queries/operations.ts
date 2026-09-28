import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { runDataIngestion, type DataIngestionType } from '@/api/dataIngestion'
import {
  fetchOperationsDashboard,
  fetchTaskRuns,
  runRoutine,
  type Routine,
  type TaskRunFilters,
} from '@/api/operations'
import { EMPTY_LIST } from '@/queries/empty'

/* As chaves do painel de operações. */
const operationsKeys = {
  all: ['operations'] as const,
  dashboard: () => [...operationsKeys.all, 'dashboard'] as const,
  runs: (filters: TaskRunFilters) => [...operationsKeys.all, 'runs', filters] as const,
}

/** Com algo rodando, o painel se atualiza mais depressa: é quando se olha. */
const REFRESH_WHILE_RUNNING_MS = 10_000
const REFRESH_IDLE_MS = 60_000

export function useOperationsDashboard() {
  const { data, isPending, isFetching, refetch, error } = useQuery({
    queryKey: operationsKeys.dashboard(),
    queryFn: fetchOperationsDashboard,
    refetchInterval: (query) =>
      query.state.data?.summary.running ? REFRESH_WHILE_RUNNING_MS : REFRESH_IDLE_MS,
  })
  return { dashboard: data, loading: isPending && !data, refreshing: isFetching, refetch, error }
}

export function useTaskRuns(filters: TaskRunFilters) {
  const { data, isPending, isFetching, refetch } = useQuery({
    queryKey: operationsKeys.runs(filters),
    queryFn: () => fetchTaskRuns(filters),
    refetchInterval: REFRESH_IDLE_MS,
  })
  return { runs: data ?? EMPTY_LIST, loading: isPending && !data, refreshing: isFetching, refetch }
}

/** "Executar agora": pela rota da ingestão, que abre a execução antes, ou
 *  pela tarefa que o agendamento envia. Uma rotina de tela não tem este botão. */
export function useRunRoutine() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (routine: Routine) => {
      if (routine.manual === 'ingestion' && routine.ingestion_type) {
        await runDataIngestion(routine.ingestion_type as DataIngestionType, false)
        return
      }
      await runRoutine(routine.key)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: operationsKeys.all }),
  })
}
