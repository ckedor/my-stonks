import {
  abortDataIngestion,
  getDataIngestion,
  listDataIngestions,
  runDataIngestion,
  type DataIngestionType,
  type IngestionStatus,
  type DataIngestionExecution,
  type DataIngestionExecutionDetail,
} from '@/api/dataIngestion'
import {
  AppAlert,
  AppButton,
  AppCard,
  AppChip,
  AppConfirmDialog,
  AppProgressBar,
  AppSimpleTable,
  AppSnackbar,
  AppStack,
  AppStatCard,
  AppText,
  AppTooltip,
  PageTitle,
  SectionTitle,
} from '@/components/ui'
import DataIngestionSkeleton from './DataIngestionSkeleton'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import HistoryIcon from '@mui/icons-material/History'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import RefreshIcon from '@mui/icons-material/Refresh'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import StorageIcon from '@mui/icons-material/Storage'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const TERMINAL_STATUSES = new Set<IngestionStatus>([
  'success',
  'partial_success',
  'failure',
  'aborted',
])

const INITIAL_POLL_DELAY_MS = 5_000
const MAX_POLL_DELAY_MS = 30_000
const QUEUED_EXECUTION_TIMEOUT_MS = 2 * 60_000

const STATUS_LABELS: Record<IngestionStatus, string> = {
  queued: 'Na fila',
  running: 'Em execução',
  success: 'Sucesso',
  partial_success: 'Sucesso parcial',
  failure: 'Falha',
  aborted: 'Abortada',
}

/* O design system não tem tom `warning` em chip, e `partial_success` não é
   nem sucesso nem falha. `info` é o mais próximo do que ele comunica: algo
   a conferir, sem afirmar que deu errado. */
const STATUS_TONES: Record<IngestionStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  queued: 'neutral',
  running: 'info',
  success: 'success',
  partial_success: 'info',
  failure: 'danger',
  aborted: 'neutral',
}

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(value))
    : '—'

const StatusChip = ({ status }: { status: IngestionStatus }) => (
  <AppChip
    label={STATUS_LABELS[status] ?? status}
    tone={STATUS_TONES[status] ?? 'neutral'}
    emphasis={status === 'queued' ? 'outline' : 'solid'}
  />
)

export interface DataIngestionPageProps {
  ingestionType: DataIngestionType
  title: string
  description: string
  itemName: string
}

export function DataIngestionPage({
  ingestionType,
  title,
  description,
  itemName,
}: DataIngestionPageProps) {
  const [executions, setExecutions] = useState<DataIngestionExecution[]>([])
  const [detail, setDetail] = useState<DataIngestionExecutionDetail | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selectedIdRef = useRef<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningRequest, setRunningRequest] = useState(false)
  const [forceDialogOpen, setForceDialogOpen] = useState(false)
  const [abortDialogOpen, setAbortDialogOpen] = useState(false)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  })

  const fetchDetail = useCallback(async (executionId: number) => {
    const data = await getDataIngestion(ingestionType, executionId)
    setDetail(data)
    setExecutions((current) =>
      current.map((item) => (item.id === data.id ? data : item)),
    )
    return data
  }, [ingestionType])

  const refreshExecutions = useCallback(async (preferredId?: number) => {
    const data = await listDataIngestions(ingestionType)
    setExecutions(data)
    const currentId = selectedIdRef.current
    const currentStillExists = data.some((execution) => execution.id === currentId)
    const nextId = preferredId
      ?? (currentStillExists ? currentId : null)
      ?? data[0]?.id
      ?? null
    selectedIdRef.current = nextId
    setSelectedId(nextId)
    if (nextId !== null) return fetchDetail(nextId)
    setDetail(null)
    return null
  }, [fetchDetail, ingestionType])

  useEffect(() => {
    const load = async () => {
      try {
        await refreshExecutions()
      } catch (error) {
        console.error(error)
        setSnackbar({ open: true, message: 'Erro ao carregar execuções', severity: 'error' })
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [refreshExecutions])

  const active = detail !== null && !TERMINAL_STATUSES.has(detail.status)
  // Abort targets whichever execution holds the slot, which is not necessarily
  // the one being inspected below.
  const activeExecution = executions.find(
    (execution) => !TERMINAL_STATUSES.has(execution.status),
  ) ?? null
  const hasActiveExecution = activeExecution !== null

  useEffect(() => {
    if (!active || selectedId === null) return
    let cancelled = false
    let timer: number | undefined
    let delay = INITIAL_POLL_DELAY_MS

    const scheduleNext = () => {
      if (!cancelled) timer = window.setTimeout(poll, delay)
    }

    const poll = async () => {
      if (cancelled) return
      if (document.visibilityState === 'hidden') {
        delay = MAX_POLL_DELAY_MS
        scheduleNext()
        return
      }

      try {
        const updated = await fetchDetail(selectedId)
        if (TERMINAL_STATUSES.has(updated.status)) {
          await refreshExecutions(updated.id)
          return
        }

        const queuedFor = Date.now() - new Date(updated.requested_at).getTime()
        if (
          updated.status === 'queued'
          && queuedFor >= QUEUED_EXECUTION_TIMEOUT_MS
        ) {
          await refreshExecutions(updated.id)
          return
        }
      } catch (error) {
        console.error(error)
      }

      delay = Math.min(delay * 2, MAX_POLL_DELAY_MS)
      scheduleNext()
    }

    scheduleNext()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [active, fetchDetail, refreshExecutions, selectedId])

  const startExecution = async (forceFullHistory: boolean) => {
    setRunningRequest(true)
    try {
      const execution = await runDataIngestion(
        ingestionType,
        forceFullHistory,
      )
      selectedIdRef.current = execution.id
      setSelectedId(execution.id)
      await refreshExecutions(execution.id)
      setSnackbar({
        open: true,
        message: forceFullHistory
          ? 'Importação completa adicionada à fila'
          : 'Importação incremental adicionada à fila',
        severity: 'success',
      })
    } catch (error) {
      console.error(error)
      setSnackbar({ open: true, message: 'Erro ao iniciar importação', severity: 'error' })
    } finally {
      setRunningRequest(false)
      setForceDialogOpen(false)
    }
  }

  const abortExecution = async () => {
    if (activeExecution === null) return
    setRunningRequest(true)
    try {
      const execution = await abortDataIngestion(ingestionType, activeExecution.id)
      selectedIdRef.current = execution.id
      setSelectedId(execution.id)
      await refreshExecutions(execution.id)
      setSnackbar({
        open: true,
        message: `Execução #${execution.id} abortada`,
        severity: 'success',
      })
    } catch (error) {
      console.error(error)
      setSnackbar({ open: true, message: 'Erro ao abortar a execução', severity: 'error' })
    } finally {
      setRunningRequest(false)
      setAbortDialogOpen(false)
    }
  }

  const progress = useMemo(() => {
    if (!detail?.total_items) return detail?.status === 'success' ? 100 : 0
    return Math.min(100, (detail.processed_items / detail.total_items) * 100)
  }, [detail])

  const selectExecution = (execution: DataIngestionExecution) => {
    selectedIdRef.current = execution.id
    setSelectedId(execution.id)
    void fetchDetail(execution.id)
  }

  if (loading) return <DataIngestionSkeleton />

  return (
    <AppStack gap="lg">
      <AppStack direction="row" justify="between" align="center" gap="md" collapseBelow="md">
        <AppStack gap="xs">
          <PageTitle>{title}</PageTitle>
          <AppText variant="bodySmall" tone="secondary">
            {description}
          </AppText>
        </AppStack>
        <AppStack direction="row" gap="sm" collapseBelow="sm">
          <AppButton
            emphasis="outline"
            icon={<RefreshIcon />}
            onClick={() => void refreshExecutions()}
            disabled={runningRequest}
          >
            Atualizar
          </AppButton>
          {hasActiveExecution && (
            <AppButton
              tone="danger"
              emphasis="outline"
              icon={<StopCircleIcon />}
              onClick={() => setAbortDialogOpen(true)}
              disabled={runningRequest}
            >
              Abortar
            </AppButton>
          )}
          <AppButton
            tone="caution"
            emphasis="outline"
            icon={<HistoryIcon />}
            onClick={() => setForceDialogOpen(true)}
            disabled={runningRequest || hasActiveExecution}
          >
            Histórico completo
          </AppButton>
          <AppButton
            icon={<PlayArrowIcon />}
            onClick={() => void startExecution(false)}
            disabled={runningRequest || hasActiveExecution}
          >
            Executar agora
          </AppButton>
        </AppStack>
      </AppStack>

      {detail ? (
        <>
          <AppStack direction="row" gap="md" wrap collapseBelow="sm">
            <AppStatCard
              label="Processados"
              value={`${detail.processed_items}/${detail.total_items}`}
              helper={detail.force_full_history ? 'Histórico completo' : 'Incremental com overlap'}
              icon={<StorageIcon />}
            />
            <AppStatCard
              label="Sucessos"
              value={detail.succeeded_items}
              helper={`${detail.upserted_rows.toLocaleString('pt-BR')} linhas persistidas`}
              icon={<TaskAltIcon />}
            />
            <AppStatCard
              label="Falhas"
              value={detail.failed_items}
              helper="Consulte as tentativas abaixo"
              icon={<ErrorOutlineIcon />}
            />
          </AppStack>

          <AppCard>
            <AppStack gap="sm">
              <AppStack direction="row" justify="between" align="center">
                <SectionTitle>Execução #{detail.id}</SectionTitle>
                <StatusChip status={detail.status} />
              </AppStack>
              <AppProgressBar
                value={detail.status === 'queued' ? undefined : progress}
                tone={detail.status === 'failure' ? 'danger' : 'primary'}
              />
              <AppText variant="caption" tone="secondary">
                Solicitada em {formatDateTime(detail.requested_at)} · início{' '}
                {formatDateTime(detail.started_at)} · fim {formatDateTime(detail.finished_at)}
              </AppText>
              {detail.error && <AppAlert severity="error">{detail.error}</AppAlert>}
            </AppStack>
          </AppCard>
        </>
      ) : (
        <AppAlert severity="info">Nenhuma importação executada até agora.</AppAlert>
      )}

      <AppStack gap="sm">
        <AppStack direction="row" justify="between" align="baseline">
          <SectionTitle>Últimas execuções</SectionTitle>
          <AppText variant="caption" tone="secondary">
            Histórico mantido por 2 dias
          </AppText>
        </AppStack>
        <AppSimpleTable
          rows={executions}
          getRowKey={(execution) => execution.id}
          surface="outlined"
          onRowClick={selectExecution}
          isRowSelected={(execution) => execution.id === selectedId}
          emptyMessage="Nenhuma execução registrada."
          columns={[
            { label: 'ID', render: (execution) => `#${execution.id}` },
            { label: 'Status', render: (execution) => <StatusChip status={execution.status} /> },
            {
              label: 'Disparo',
              render: (execution) => (execution.trigger === 'manual' ? 'Manual' : 'Agendado'),
            },
            {
              label: 'Modo',
              render: (execution) => (execution.force_full_history ? 'Completo' : 'Incremental'),
            },
            {
              label: 'Solicitada em',
              render: (execution) => formatDateTime(execution.requested_at),
            },
            {
              label: 'Progresso',
              align: 'right',
              render: (execution) => `${execution.processed_items}/${execution.total_items}`,
            },
            {
              label: 'Sucessos',
              align: 'right',
              render: (execution) => execution.succeeded_items,
            },
            { label: 'Falhas', align: 'right', render: (execution) => execution.failed_items },
          ]}
        />
      </AppStack>

      <AppStack gap="sm">
        <SectionTitle>Tentativas por {itemName}</SectionTitle>
        <AppSimpleTable
          rows={detail?.attempts ?? []}
          getRowKey={(attempt) => attempt.id}
          surface="outlined"
          emptyMessage={
            detail && !TERMINAL_STATUSES.has(detail.status)
              ? 'Aguardando as primeiras tentativas…'
              : 'Nenhuma tentativa registrada.'
          }
          columns={[
            {
              label: itemName,
              render: (attempt) => (
                <AppStack>
                  <AppText variant="bodySmall" weight="strong">
                    {attempt.item_label}
                  </AppText>
                  <AppText variant="caption" tone="secondary">
                    ID {attempt.item_id ?? '—'}
                  </AppText>
                </AppStack>
              ),
            },
            {
              label: 'Fonte',
              render: (attempt) => <AppChip label={attempt.source} emphasis="outline" />,
            },
            { label: 'Status', render: (attempt) => <StatusChip status={attempt.status} /> },
            {
              label: 'Tentativa',
              render: (attempt) => (
                <AppStack>
                  <AppText variant="bodySmall">{formatDateTime(attempt.attempted_at)}</AppText>
                  <AppText variant="caption" tone="secondary">
                    fim {formatDateTime(attempt.finished_at)}
                  </AppText>
                </AppStack>
              ),
            },
            {
              label: 'Parâmetros',
              width: 'clamped',
              render: (attempt) => (
                <AppTooltip title={JSON.stringify(attempt.parameters, null, 2)}>
                  <AppText variant="caption" tone="secondary">
                    {JSON.stringify(attempt.parameters)}
                  </AppText>
                </AppTooltip>
              ),
            },
            { label: 'Recebidas', align: 'right', render: (attempt) => attempt.fetched_rows },
            { label: 'Persistidas', align: 'right', render: (attempt) => attempt.upserted_rows },
            {
              label: 'Erro',
              width: 'clamped',
              render: (attempt) => (
                <AppText variant="bodySmall" tone={attempt.error ? 'danger' : 'secondary'}>
                  {attempt.error ?? '—'}
                </AppText>
              ),
            },
          ]}
        />
      </AppStack>

      <AppConfirmDialog
        open={forceDialogOpen}
        title="Buscar histórico completo?"
        tone="caution"
        confirmLabel="Executar histórico completo"
        onConfirm={() => void startExecution(true)}
        onCancel={() => setForceDialogOpen(false)}
      >
        Essa execução ignora a última data persistida e solicita o máximo disponível. Ela pode
        consumir mais tempo e chamadas externas.
      </AppConfirmDialog>

      <AppConfirmDialog
        open={abortDialogOpen}
        title={`Abortar a execução #${activeExecution?.id}?`}
        confirmLabel="Abortar execução"
        confirmDisabled={runningRequest}
        onConfirm={() => void abortExecution()}
        onCancel={() => setAbortDialogOpen(false)}
      >
        A execução é encerrada e libera a fila na hora, e o worker para nos itens seguintes. O item
        que já está sendo buscado agora termina normalmente. O que foi persistido até aqui é
        mantido.
      </AppConfirmDialog>

      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
      />
    </AppStack>
  )
}
