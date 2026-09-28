import type { RoutineKey } from '@/api/operations'
import { AppCard, AppChip, AppLink, AppSkeleton, AppStack, AppText } from '@/components/ui'
import { useOperationsDashboard } from '@/queries/operations'

import { INTEGRATIONS_PATH } from '../navigation'
import { formatDuration, formatRelative, formatWhen, HEALTH } from './operationsFormat'

/* A faixa que abre a tela de uma rotina: quando ela roda, quando rodou e
 * como terminou. Lê a mesma resposta do painel, então as duas telas não
 * podem discordar sobre a mesma rotina. */

export default function RoutineScheduleNote({ routineKey }: { routineKey: RoutineKey }) {
  const { dashboard, loading } = useOperationsDashboard()
  const routine = dashboard?.routines.find((item) => item.key === routineKey)

  if (loading) return <AppSkeleton shape="rounded" height={64} />
  if (!routine) return null

  const health = HEALTH[routine.health]
  const lastRun = routine.last_run
  const lastStarted = lastRun?.started_at ?? lastRun?.execution?.requested_at ?? null

  return (
    <AppCard padding="md">
      <AppStack direction="row" gap="lg" align="center" wrap>
        <AppStack gap="xs">
          <AppText variant="caption" tone="secondary">
            Quando roda
          </AppText>
          <AppText variant="bodySmall" weight="strong">
            {routine.schedules.length
              ? routine.schedules.map((schedule) => schedule.description).join(' · ')
              : 'Sob demanda'}
          </AppText>
        </AppStack>
        {routine.next_run_at && (
          <AppStack gap="xs">
            <AppText variant="caption" tone="secondary">
              Próxima
            </AppText>
            <AppText variant="bodySmall" weight="strong">
              {formatWhen(routine.next_run_at)}
            </AppText>
          </AppStack>
        )}
        <AppStack gap="xs">
          <AppText variant="caption" tone="secondary">
            Última
          </AppText>
          <AppText variant="bodySmall" weight="strong">
            {lastStarted
              ? `${formatRelative(lastStarted)} · ${formatDuration(lastRun?.duration_seconds)}`
              : 'Nenhuma registrada'}
          </AppText>
        </AppStack>
        <AppChip label={health.label} tone={health.tone} />
        <AppLink to={INTEGRATIONS_PATH}>Ver no painel</AppLink>
      </AppStack>
    </AppCard>
  )
}
