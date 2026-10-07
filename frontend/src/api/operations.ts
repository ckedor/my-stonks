import { OPERATIONS_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

/* O painel de operações: cada rotina que sincroniza ou integra dados, quando
 * roda, como terminou a última vez e o que vem a seguir. Espelha
 * `backend/app/modules/operations/api/schemas.py`. */

export type RoutineKey =
  | 'quotes'
  | 'market_series'
  | 'usd_brl'
  | 'fund_share_values'
  | 'etf_holdings'
  | 'fund_registry'
  | 'etf_registry'
  | 'asset_catalogue'
  | 'company_registry'
  | 'fund_links'
  | 'portfolio_consolidation'
  | 'fii_dividends'
  | 'ai_features'
  | 'execution_history'

export type RoutineGroup = 'market_data' | 'reference_data' | 'portfolios' | 'ai' | 'maintenance'

/** Como alguém dispara a rotina à mão. */
export type RoutineManualStart = 'task' | 'ingestion' | 'screen'

export type RoutineFrequency = 'intraday' | 'daily' | 'weekly' | 'monthly' | 'other' | 'on_demand'

export type RoutineHealth =
  | 'ok'
  | 'warning'
  | 'failing'
  | 'running'
  | 'missed'
  | 'never'
  | 'on_demand'

export type TaskRunTrigger = 'scheduled' | 'manual' | 'chained'
export type TaskRunStatus = 'running' | 'success' | 'failure'

export interface TaskRun {
  id: number
  task_name: string
  routine_key: RoutineKey | null
  routine_name: string | null
  trigger: TaskRunTrigger
  status: TaskRunStatus
  started_at: string
  finished_at: string | null
  duration_seconds: number | null
  arguments: Record<string, unknown>
  result: unknown
  error: string | null
}

export interface RoutineSchedule {
  entry: string
  task: string
  description: string
  frequency: Exclude<RoutineFrequency, 'on_demand'>
  next_runs: string[]
  previous_run_at: string | null
}

export interface RoutineLastRun {
  id: number | null
  task_name: string | null
  trigger: TaskRunTrigger | null
  status: TaskRunStatus | null
  started_at: string | null
  finished_at: string | null
  duration_seconds: number | null
  error: string | null
  /** Como terminaram as tarefas que ela disparou, por situação. */
  children: Partial<Record<TaskRunStatus, number>>
  execution: {
    id: number
    status: string
    trigger: string
    requested_at: string | null
    finished_at: string | null
    total_items: number
    succeeded_items: number
    failed_items: number
    error: string | null
  } | null
}

export interface Routine {
  key: RoutineKey
  name: string
  group: RoutineGroup
  description: string
  manual: RoutineManualStart
  ingestion_type: string | null
  tasks: string[]
  schedules: RoutineSchedule[]
  frequency: RoutineFrequency
  next_run_at: string | null
  last_run: RoutineLastRun | null
  health: RoutineHealth
}

export interface OperationsDashboard {
  generated_at: string
  timezone: string
  summary: {
    routines: number
    scheduled_routines: number
    running: number
    attention: number
    runs_last_day: number
    failures_last_day: number
    failures_last_week: number
    next_run_at: string | null
  }
  routines: Routine[]
  upcoming: { routine_key: RoutineKey; routine_name: string; at: string; schedule: string }[]
  recent_runs: TaskRun[]
}

export interface TaskRunFilters {
  routine?: RoutineKey
  status?: TaskRunStatus
  includeChained: boolean
  limit: number
}

export const fetchOperationsDashboard = () =>
  api.get<OperationsDashboard>(OPERATIONS_ROUTES.dashboard).then((response) => response.data)

export const fetchTaskRuns = ({ routine, status, includeChained, limit }: TaskRunFilters) =>
  api
    .get<TaskRun[]>(OPERATIONS_ROUTES.runs, {
      params: { routine, status, include_chained: includeChained, limit },
    })
    .then((response) => response.data)

export const runRoutine = (routine: RoutineKey) =>
  api
    .post<{ routine: RoutineKey; dispatched: { task: string; task_id: string }[] }>(
      OPERATIONS_ROUTES.runRoutine(routine),
    )
    .then((response) => response.data)

/* Quanto espaço o banco ocupa, tabela a tabela. Espelha
 * `DatabaseStorageResponse` em `backend/app/modules/operations/api/schemas.py`. */

export interface TableStorage {
  schema_name: string
  name: string
  /** Estimativa do planejador, não uma contagem. */
  rows: number
  table_bytes: number
  index_bytes: number
  total_bytes: number
}

export interface DatabaseStorage {
  database_bytes: number
  tables: TableStorage[]
}

export const fetchDatabaseStorage = () =>
  api.get<DatabaseStorage>(OPERATIONS_ROUTES.storage).then((response) => response.data)

/* O bucket de arquivos, por pasta de primeiro nível — que é como cada dono de
 * objetos se identifica. Espelha `BucketUsageResponse`. */

export interface BucketPrefix {
  /** Vazio para o que não está em pasta nenhuma. */
  prefix: string
  objects: number
  bytes: number
  last_modified: string | null
}

export interface BucketUsage {
  /** Falso quando o deploy não tem bucket: o resto vem vazio. */
  configured: boolean
  bucket: string | null
  objects: number
  bytes: number
  /** A listagem parou no limite: os totais são um piso. */
  truncated: boolean
  prefixes: BucketPrefix[]
}

export const fetchBucketUsage = () =>
  api.get<BucketUsage>(OPERATIONS_ROUTES.bucket).then((response) => response.data)
