import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { runDataIngestion, type DataIngestionType } from '@/api/dataIngestion'
import {
  fetchBucketUsage,
  fetchDatabaseStorage,
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
  storage: () => [...operationsKeys.all, 'storage'] as const,
  bucket: () => [...operationsKeys.all, 'bucket'] as const,
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

/** Uma fotografia do catálogo do banco: não se persiste, e não precisa de
 *  mais que a releitura a cada minuto. */
export function useDatabaseStorage() {
  const { data, isPending, isFetching, error } = useQuery({
    queryKey: operationsKeys.storage(),
    queryFn: fetchDatabaseStorage,
    refetchInterval: REFRESH_IDLE_MS,
    meta: { persist: false },
  })
  return { storage: data, loading: isPending && !data, refreshing: isFetching, error }
}

/** O bucket é listado objeto a objeto, então se relê só quando se pede: sem
 *  intervalo, e fora da persistência. */
export function useBucketUsage() {
  const { data, isPending, isFetching, error } = useQuery({
    queryKey: operationsKeys.bucket(),
    queryFn: fetchBucketUsage,
    meta: { persist: false },
  })
  return { usage: data, loading: isPending && !data, refreshing: isFetching, error }
}
