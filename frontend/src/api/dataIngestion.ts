import { DATA_INGESTION_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

export type DataIngestionType = 'quote' | 'market_data_series' | 'usd_brl'
export type IngestionStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'partial_success'
  | 'failure'

export interface DataIngestionExecution {
  id: number
  ingestion_type: DataIngestionType
  task_id: string | null
  trigger: 'manual' | 'scheduled'
  status: IngestionStatus
  force_full_history: boolean
  parameters: Record<string, unknown>
  requested_by_user_id: number | null
  requested_at: string
  started_at: string | null
  finished_at: string | null
  total_items: number
  processed_items: number
  succeeded_items: number
  failed_items: number
  fetched_rows: number
  upserted_rows: number
  error: string | null
}

export interface DataIngestionAttempt {
  id: number
  execution_id: number
  item_id: number | null
  item_label: string
  source: string
  status: IngestionStatus
  parameters: Record<string, unknown>
  attempted_at: string
  finished_at: string | null
  fetched_rows: number
  upserted_rows: number
  error: string | null
}

export interface DataIngestionExecutionDetail extends DataIngestionExecution {
  attempts: DataIngestionAttempt[]
}

export const listDataIngestions = (ingestionType: DataIngestionType) =>
  api
    .get<DataIngestionExecution[]>(DATA_INGESTION_ROUTES.list(ingestionType))
    .then((response) => response.data)

export const getDataIngestion = (
  ingestionType: DataIngestionType,
  executionId: number,
) =>
  api
    .get<DataIngestionExecutionDetail>(
      DATA_INGESTION_ROUTES.byId(ingestionType, executionId),
    )
    .then((response) => response.data)

export const runDataIngestion = (
  ingestionType: DataIngestionType,
  forceFullHistory: boolean,
) =>
  api
    .post<DataIngestionExecution>(DATA_INGESTION_ROUTES.run(ingestionType), {
      force_full_history: forceFullHistory,
    })
    .then((response) => response.data)
