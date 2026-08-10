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
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import HistoryIcon from '@mui/icons-material/History'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import RefreshIcon from '@mui/icons-material/Refresh'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import StorageIcon from '@mui/icons-material/Storage'
import TaskAltIcon from '@mui/icons-material/TaskAlt'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
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

const STATUS_COLORS: Record<
  IngestionStatus,
  'default' | 'info' | 'success' | 'warning' | 'error'
> = {
  queued: 'default',
  running: 'info',
  success: 'success',
  partial_success: 'warning',
  failure: 'error',
  aborted: 'default',
}

const formatDateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(value))
    : '—'

const StatusChip = ({ status }: { status: IngestionStatus }) => (
  <Chip
    size="small"
    label={STATUS_LABELS[status] ?? status}
    color={STATUS_COLORS[status] ?? 'default'}
    variant={status === 'queued' ? 'outlined' : 'filled'}
  />
)

function SummaryCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string
  value: string | number
  helper: string
  icon: React.ReactNode
}) {
  return (
    <Card variant="outlined" sx={{ minWidth: 190, flex: 1 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="start">
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h4" sx={{ mt: 0.5 }}>
              {value}
            </Typography>
          </Box>
          <Box color="primary.main">{icon}</Box>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {helper}
        </Typography>
      </CardContent>
    </Card>
  )
}

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

  if (loading) return <LoadingSpinner />

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        gap={2}
        mb={3}
      >
        <Box>
          <Typography variant="h5">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void refreshExecutions()}
            disabled={runningRequest}
          >
            Atualizar
          </Button>
          {hasActiveExecution && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<StopCircleIcon />}
              onClick={() => setAbortDialogOpen(true)}
              disabled={runningRequest}
            >
              Abortar
            </Button>
          )}
          <Button
            variant="outlined"
            color="warning"
            startIcon={<HistoryIcon />}
            onClick={() => setForceDialogOpen(true)}
            disabled={runningRequest || hasActiveExecution}
          >
            Histórico completo
          </Button>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={() => void startExecution(false)}
            disabled={runningRequest || hasActiveExecution}
          >
            Executar agora
          </Button>
        </Stack>
      </Stack>

      {detail ? (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={2} mb={2} flexWrap="wrap">
            <SummaryCard
              title="Processados"
              value={`${detail.processed_items}/${detail.total_items}`}
              helper={detail.force_full_history ? 'Histórico completo' : 'Incremental com overlap'}
              icon={<StorageIcon />}
            />
            <SummaryCard
              title="Sucessos"
              value={detail.succeeded_items}
              helper={`${detail.upserted_rows.toLocaleString('pt-BR')} linhas persistidas`}
              icon={<TaskAltIcon />}
            />
            <SummaryCard
              title="Falhas"
              value={detail.failed_items}
              helper="Consulte as tentativas abaixo"
              icon={<ErrorOutlineIcon />}
            />
          </Stack>

          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2">Execução #{detail.id}</Typography>
              <StatusChip status={detail.status} />
            </Stack>
            <LinearProgress
              variant={detail.status === 'queued' ? 'indeterminate' : 'determinate'}
              value={progress}
              color={detail.status === 'failure' ? 'error' : 'primary'}
            />
            <Typography variant="caption" color="text.secondary">
              Solicitada em {formatDateTime(detail.requested_at)} · início {formatDateTime(detail.started_at)} · fim {formatDateTime(detail.finished_at)}
            </Typography>
            {detail.error && <Alert severity="error" sx={{ mt: 1 }}>{detail.error}</Alert>}
          </Paper>
        </>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          Nenhuma importação executada até agora.
        </Alert>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
        <Typography variant="h6">Últimas execuções</Typography>
        <Typography variant="caption" color="text.secondary">
          Histórico mantido por 2 dias
        </Typography>
      </Stack>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Disparo</TableCell>
              <TableCell>Modo</TableCell>
              <TableCell>Solicitada em</TableCell>
              <TableCell align="right">Progresso</TableCell>
              <TableCell align="right">Sucessos</TableCell>
              <TableCell align="right">Falhas</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {executions.map((execution) => (
              <TableRow
                key={execution.id}
                hover
                selected={execution.id === selectedId}
                onClick={() => {
                  selectedIdRef.current = execution.id
                  setSelectedId(execution.id)
                  void fetchDetail(execution.id)
                }}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>#{execution.id}</TableCell>
                <TableCell><StatusChip status={execution.status} /></TableCell>
                <TableCell>{execution.trigger === 'manual' ? 'Manual' : 'Agendado'}</TableCell>
                <TableCell>{execution.force_full_history ? 'Completo' : 'Incremental'}</TableCell>
                <TableCell>{formatDateTime(execution.requested_at)}</TableCell>
                <TableCell align="right">{execution.processed_items}/{execution.total_items}</TableCell>
                <TableCell align="right">{execution.succeeded_items}</TableCell>
                <TableCell align="right">{execution.failed_items}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h6" mb={1}>Tentativas por {itemName}</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{itemName}</TableCell>
              <TableCell>Fonte</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Tentativa</TableCell>
              <TableCell>Parâmetros</TableCell>
              <TableCell align="right">Recebidas</TableCell>
              <TableCell align="right">Persistidas</TableCell>
              <TableCell>Erro</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detail?.attempts.length ? detail.attempts.map((attempt) => (
              <TableRow key={attempt.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{attempt.item_label}</Typography>
                  <Typography variant="caption" color="text.secondary">ID {attempt.item_id ?? '—'}</Typography>
                </TableCell>
                <TableCell><Chip size="small" variant="outlined" label={attempt.source} /></TableCell>
                <TableCell><StatusChip status={attempt.status} /></TableCell>
                <TableCell>
                  <Typography variant="body2">{formatDateTime(attempt.attempted_at)}</Typography>
                  <Typography variant="caption" color="text.secondary">fim {formatDateTime(attempt.finished_at)}</Typography>
                </TableCell>
                <TableCell sx={{ maxWidth: 330 }}>
                  <Tooltip title={JSON.stringify(attempt.parameters, null, 2)}>
                    <Typography variant="caption" component="code" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {JSON.stringify(attempt.parameters)}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell align="right">{attempt.fetched_rows}</TableCell>
                <TableCell align="right">{attempt.upserted_rows}</TableCell>
                <TableCell sx={{ maxWidth: 280 }}>
                  <Typography variant="body2" color={attempt.error ? 'error' : 'text.secondary'}>
                    {attempt.error ?? '—'}
                  </Typography>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {detail && !TERMINAL_STATUSES.has(detail.status)
                    ? 'Aguardando as primeiras tentativas…'
                    : 'Nenhuma tentativa registrada.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={forceDialogOpen} onClose={() => setForceDialogOpen(false)}>
        <DialogTitle>Buscar histórico completo?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Essa execução ignora a última data persistida e solicita o máximo disponível. Ela pode consumir mais tempo e chamadas externas.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForceDialogOpen(false)}>Cancelar</Button>
          <Button color="warning" variant="contained" onClick={() => void startExecution(true)}>
            Executar histórico completo
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={abortDialogOpen} onClose={() => setAbortDialogOpen(false)}>
        <DialogTitle>Abortar a execução #{activeExecution?.id}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            A execução é encerrada e libera a fila na hora, e o worker para nos itens
            seguintes. O item que já está sendo buscado agora termina normalmente. O que
            foi persistido até aqui é mantido.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbortDialogOpen(false)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void abortExecution()}
            disabled={runningRequest}
          >
            Abortar execução
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
