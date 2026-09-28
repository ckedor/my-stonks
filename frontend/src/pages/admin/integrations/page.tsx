import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { Routine, RoutineFrequency, RoutineGroup } from '@/api/operations'
import {
  AppAlert,
  AppButton,
  AppCard,
  AppChip,
  AppConfirmDialog,
  AppGrid,
  AppGridItem,
  AppLink,
  AppMetric,
  AppPageHeader,
  AppSimpleTable,
  type AppSimpleTableColumn,
  AppSnackbar,
  AppStack,
  AppText,
  AppToggleGroup,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import { useOperationsDashboard, useRunRoutine } from '@/queries/operations'

import { INTEGRATIONS_PATH } from '../navigation'
import IntegrationsDashboardSkeleton from './IntegrationsDashboardSkeleton'
import {
  formatDuration,
  formatRelative,
  formatWhen,
  FREQUENCY_LABEL,
  FREQUENCY_ORDER,
  GROUP_LABEL,
  GROUP_ORDER,
  HEALTH,
  ROUTINE_PAGES,
  TRIGGER_LABEL,
} from './operationsFormat'
import TaskRunsTable from './TaskRunsTable'

/* O painel de integrações: toda rotina que traz dado de fora ou o mantém
 * consistente, com quando roda, como terminou a última vez e o que vem a
 * seguir. Os horários vêm do agendamento do worker e as execuções do registro
 * que o próprio worker grava — nada aqui é digitado à mão, então o painel não
 * tem como discordar do que roda. */

type Grouping = 'area' | 'frequency'

const GROUPINGS: { value: Grouping; label: string }[] = [
  { value: 'area', label: 'Por área' },
  { value: 'frequency', label: 'Por frequência' },
]

const ATTENTION = new Set(['failing', 'warning', 'missed'])

function lastStarted(routine: Routine): string | null {
  return routine.last_run?.started_at ?? routine.last_run?.execution?.requested_at ?? null
}

/** Por que a rotina pede atenção, numa frase. */
function attentionReason(routine: Routine): string {
  const run = routine.last_run
  if (routine.health === 'missed') {
    const due = routine.schedules
      .map((schedule) => schedule.previous_run_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1)
    return `Devia ter rodado ${formatWhen(due)} e nada começou. A última execução foi ${formatRelative(lastStarted(routine))}.`
  }
  const execution = run?.execution
  if (execution && execution.failed_items > 0) {
    return `${execution.failed_items} de ${execution.total_items} itens falharam na execução #${execution.id}.`
  }
  const failedChildren = run?.children.failure ?? 0
  if (failedChildren > 0) {
    const total = Object.values(run?.children ?? {}).reduce((sum, count) => sum + (count ?? 0), 0)
    return `${failedChildren} de ${total} tarefas disparadas falharam.`
  }
  return run?.error ?? execution?.error ?? HEALTH[routine.health].hint
}

function whenItRuns(routine: Routine): string {
  return routine.schedules.length
    ? routine.schedules.map((schedule) => schedule.description).join(' · ')
    : 'Sob demanda'
}

function lastRunText(routine: Routine): string {
  const started = lastStarted(routine)
  if (!started) return 'Nenhuma registrada'
  const run = routine.last_run
  const parts = [formatRelative(started)]
  if (run?.trigger) parts.push(TRIGGER_LABEL[run.trigger].toLowerCase())
  if (run?.duration_seconds !== null && run?.duration_seconds !== undefined) {
    parts.push(formatDuration(run.duration_seconds))
  }
  return parts.join(' · ')
}

export default function AdminIntegrationsPage() {
  const navigate = useNavigate()
  const { dashboard, loading, refreshing, refetch, error } = useOperationsDashboard()
  const runRoutine = useRunRoutine()
  const [grouping, setGrouping] = useState<Grouping>('area')
  const [confirming, setConfirming] = useState<Routine | null>(null)
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  })

  const routines = dashboard?.routines
  const groups = useMemo(() => {
    if (!routines) return []
    if (grouping === 'area') {
      return GROUP_ORDER.map((group: RoutineGroup) => ({
        label: GROUP_LABEL[group],
        routines: routines.filter((routine) => routine.group === group),
      })).filter((group) => group.routines.length)
    }
    return FREQUENCY_ORDER.map((frequency: RoutineFrequency) => ({
      label: FREQUENCY_LABEL[frequency],
      routines: routines.filter((routine) => routine.frequency === frequency),
    })).filter((group) => group.routines.length)
  }, [routines, grouping])

  if (loading) return <IntegrationsDashboardSkeleton />
  if (error || !dashboard) {
    return <AppAlert severity="error">Não foi possível carregar o painel de integrações.</AppAlert>
  }

  const { summary } = dashboard
  const attention = dashboard.routines.filter((routine) => ATTENTION.has(routine.health))
  const nextUp = dashboard.upcoming[0]

  const start = (routine: Routine) => {
    setConfirming(null)
    runRoutine.mutate(routine, {
      onSuccess: () =>
        setSnackbar({
          open: true,
          message: `${routine.name}: execução enviada ao worker`,
          severity: 'success',
        }),
      onError: () =>
        setSnackbar({
          open: true,
          message: `${routine.name}: não foi possível disparar. Já há uma execução em andamento?`,
          severity: 'error',
        }),
    })
  }

  const actions = (routine: Routine) => {
    const page = ROUTINE_PAGES[routine.key]
    return (
      <AppStack direction="row" gap="sm" justify="end">
        {routine.manual !== 'screen' && (
          <AppButton
            size="sm"
            emphasis="outline"
            loading={runRoutine.isPending && runRoutine.variables?.key === routine.key}
            disabled={routine.health === 'running'}
            onClick={() => setConfirming(routine)}
          >
            Executar agora
          </AppButton>
        )}
        {page && (
          <AppButton size="sm" emphasis="ghost" onClick={() => navigate(page)}>
            Abrir
          </AppButton>
        )}
      </AppStack>
    )
  }

  const columns: AppSimpleTableColumn<Routine>[] = [
    {
      label: 'Rotina',
      share: 0.34,
      render: (routine) => (
        <AppStack gap="none">
          <AppText variant="bodySmall" weight="strong">
            {routine.name}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {routine.description}
          </AppText>
        </AppStack>
      ),
    },
    { label: 'Quando roda', share: 0.17, render: whenItRuns },
    { label: 'Próxima', share: 0.1, render: (routine) => formatWhen(routine.next_run_at) },
    { label: 'Última execução', share: 0.13, render: lastRunText },
    {
      label: 'Situação',
      share: 0.1,
      render: (routine) => (
        <AppChip label={HEALTH[routine.health].label} tone={HEALTH[routine.health].tone} />
      ),
    },
    { label: '', align: 'right', share: 0.16, render: actions },
  ]

  return (
    <>
      <AppStack gap="lg">
        <AppPageHeader
          title="Painel"
          description={`Tudo o que sincroniza ou integra dados: quando roda, como terminou e o que vem a seguir. Horários de Brasília; atualizado ${formatWhen(dashboard.generated_at)}.`}
          actions={
            <AppButton emphasis="outline" loading={refreshing} onClick={() => void refetch()}>
              Atualizar
            </AppButton>
          }
          metrics={
            <AppStack direction="row" gap="xl" wrap>
              <AppMetric
                label="Precisam de atenção"
                value={String(summary.attention)}
                tone={summary.attention ? 'danger' : 'default'}
              />
              <AppMetric label="Rodando agora" value={String(summary.running)} />
              <AppMetric
                label="Execuções em 24 h"
                value={String(summary.runs_last_day)}
              />
              <AppMetric
                label="Falhas em 24 h"
                value={String(summary.failures_last_day)}
                tone={summary.failures_last_day ? 'danger' : 'default'}
              />
              <AppMetric
                label="Falhas em 7 dias"
                value={String(summary.failures_last_week)}
                tone={summary.failures_last_week ? 'danger' : 'default'}
              />
              <AppMetric
                label="Próxima execução"
                value={nextUp ? `${formatWhen(nextUp.at)} · ${nextUp.routine_name}` : '—'}
              />
            </AppStack>
          }
        />

        {attention.length > 0 && (
          <AppStack gap="md">
            <SectionTitle>Precisa de atenção</SectionTitle>
            <AppStack gap="sm">
              {attention.map((routine) => (
                <AppCard key={routine.key} padding="md">
                  <AppStack direction="row" gap="md" align="center" justify="between" wrap>
                    <AppStack gap="xs">
                      <AppStack direction="row" gap="sm" align="center">
                        <AppText weight="strong">{routine.name}</AppText>
                        <AppChip
                          label={HEALTH[routine.health].label}
                          tone={HEALTH[routine.health].tone}
                        />
                      </AppStack>
                      <AppText variant="bodySmall" tone="secondary">
                        {attentionReason(routine)}
                      </AppText>
                    </AppStack>
                    {actions(routine)}
                  </AppStack>
                </AppCard>
              ))}
            </AppStack>
          </AppStack>
        )}

        <AppStack gap="md">
          <AppStack direction="row" align="center" justify="between" wrap gap="md">
            <SectionTitle>Rotinas</SectionTitle>
            <AppToggleGroup<Grouping>
              label="Agrupar rotinas"
              value={grouping}
              onChange={setGrouping}
              options={GROUPINGS}
            />
          </AppStack>
          {groups.map((group) => (
            <AppStack key={group.label} gap="sm">
              <SectionLabel>{group.label}</SectionLabel>
              <AppSimpleTable<Routine>
                columns={columns}
                rows={group.routines}
                getRowKey={(routine) => routine.key}
                surface="outlined"
              />
            </AppStack>
          ))}
        </AppStack>

        <AppGrid cols={{ xs: 1, lg: 3 }} gap="lg" align="start">
          <AppGridItem>
            <AppStack gap="md">
              <SectionTitle>Próximas 24 horas</SectionTitle>
              <AppCard padding="md">
                {dashboard.upcoming.length ? (
                  <AppStack gap="sm">
                    {dashboard.upcoming.map((item) => (
                      <AppStack
                        key={`${item.routine_key}-${item.at}`}
                        direction="row"
                        gap="md"
                        align="center"
                      >
                        <AppText variant="bodySmall" weight="strong">
                          {formatWhen(item.at)}
                        </AppText>
                        <AppText variant="bodySmall">{item.routine_name}</AppText>
                      </AppStack>
                    ))}
                  </AppStack>
                ) : (
                  <AppText variant="bodySmall" tone="secondary">
                    Nada agendado nas próximas 24 horas.
                  </AppText>
                )}
              </AppCard>
            </AppStack>
          </AppGridItem>
          <AppGridItem span={{ xs: 1, lg: 2 }}>
            <AppStack gap="md">
              <AppStack direction="row" align="center" justify="between">
                <SectionTitle>Execuções recentes</SectionTitle>
                <AppLink to={`${INTEGRATIONS_PATH}/runs`}>Ver todas</AppLink>
              </AppStack>
              <TaskRunsTable
                runs={dashboard.recent_runs}
                emptyMessage="Nenhuma execução registrada ainda."
              />
            </AppStack>
          </AppGridItem>
        </AppGrid>
      </AppStack>

      <AppConfirmDialog
        open={confirming !== null}
        title={`Executar ${confirming?.name ?? ''} agora?`}
        tone="primary"
        confirmLabel="Executar agora"
        confirmDisabled={runRoutine.isPending}
        onConfirm={() => confirming && start(confirming)}
        onCancel={() => setConfirming(null)}
      >
        {confirming?.manual === 'ingestion'
          ? 'Abre uma execução de ingestão, como a agendada, e a envia ao worker.'
          : 'Envia ao worker a mesma tarefa que o agendamento envia.'}
      </AppConfirmDialog>

      <AppSnackbar
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </>
  )
}
