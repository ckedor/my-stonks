import {
  AppAlert,
  AppButton,
  AppCard,
  AppCollapse,
  AppDivider,
  AppPageHeader,
  AppStack,
  AppStackItem,
  AppText,
  AppTextField,
  SectionLabel,
} from '@/components/ui'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded'
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined'
import { Box, CircularProgress } from '@mui/material'
import { Fragment, useState } from 'react'
import type { DeployOverview, DeployRun, DeployStep, StepStatus } from './contract'
import { useDeploy } from './useDeploy'

/* O painel de deploy: o CI deste repositório, numa tela.
 *
 * Verificar roda os hooks do `.pre-commit-config.yaml` sobre o que vai subir
 * e não toca em nada. Deploy roda os mesmos hooks e, se nada que bloqueia
 * falhou, commita tudo e faz push para main. Quem executa é o dev server
 * (`tools/server/deploy-runner.ts`). */

const STATUS: Record<StepStatus, { label: string; tone: 'success' | 'danger' | 'caution' | 'secondary' | 'disabled' | 'primary' }> = {
  passed: { label: 'passou', tone: 'success' },
  failed: { label: 'falhou', tone: 'danger' },
  warning: { label: 'falhou por dentro — não bloqueia', tone: 'caution' },
  skipped: { label: 'pulou', tone: 'secondary' },
  running: { label: 'rodando', tone: 'primary' },
  pending: { label: 'na fila', tone: 'disabled' },
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'running') return <CircularProgress size={16} thickness={5} />
  const icon = {
    passed: <CheckCircleRoundedIcon fontSize="small" />,
    failed: <CancelRoundedIcon fontSize="small" />,
    warning: <ErrorRoundedIcon fontSize="small" />,
    skipped: <RemoveCircleOutlineRoundedIcon fontSize="small" />,
    pending: <RadioButtonUncheckedRoundedIcon fontSize="small" />,
  }[status]
  return (
    <AppText variant="bodySmall" tone={STATUS[status].tone} inline>
      {icon}
    </AppText>
  )
}

const duration = (ms?: number) => {
  if (ms == null) return ''
  if (ms < 1000) return `${(ms / 1000).toFixed(1).replace('.', ',')} s`
  const seconds = Math.round(ms / 1000)
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

const elapsed = (step: DeployStep) =>
  step.status === 'running' && step.startedAt ? duration(Date.now() - step.startedAt) : duration(step.durationMs)

function Log({ text }: { text: string }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        mt: 1,
        p: 2,
        maxHeight: 360,
        overflow: 'auto',
        borderRadius: 1,
        bgcolor: 'action.hover',
        fontFamily: "'JetBrains Mono Variable', Menlo, monospace",
        fontSize: 12,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {text || 'Sem saída.'}
    </Box>
  )
}

function StepRow({ step, open, onToggle }: { step: DeployStep; open: boolean; onToggle: () => void }) {
  const expandable = Boolean(step.output)
  return (
    <Box
      onClick={expandable ? onToggle : undefined}
      sx={{ py: 1.5, px: 1, borderRadius: 1, cursor: expandable ? 'pointer' : 'default', '&:hover': expandable ? { bgcolor: 'action.hover' } : undefined }}
    >
      <AppStack direction="row" gap="md" align="center">
        <Box sx={{ width: 20, display: 'flex', justifyContent: 'center' }}>
          <StatusIcon status={step.status} />
        </Box>
        <AppStackItem>
          <AppStack gap="xs">
            <AppStack direction="row" gap="sm" align="baseline" wrap>
              <AppText variant="bodySmall" weight="strong">
                {step.label}
              </AppText>
              {!step.blocking && (
                <AppText variant="caption" tone="secondary">
                  não bloqueia
                </AppText>
              )}
            </AppStack>
            {(step.summary || step.status !== 'pending') && (
              <AppText variant="caption" tone={step.status === 'failed' ? 'danger' : 'secondary'}>
                {step.summary || STATUS[step.status].label}
              </AppText>
            )}
          </AppStack>
        </AppStackItem>
        <AppText variant="caption" tone="secondary">
          {elapsed(step)}
        </AppText>
        <Box sx={{ width: 20, color: 'text.secondary', visibility: expandable ? 'visible' : 'hidden', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <ExpandMoreRoundedIcon fontSize="small" />
        </Box>
      </AppStack>
      <AppCollapse open={open}>
        <Box onClick={(event) => event.stopPropagation()} sx={{ pl: 4.5 }}>
          <Log text={step.output} />
        </Box>
      </AppCollapse>
    </Box>
  )
}

/** As checagens de uma execução, e o commit e o push quando é deploy. */
function Pipeline({ run }: { run: DeployRun }) {
  // Uma falha abre sozinha: é a saída que se quer ler.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isOpen = (step: DeployStep) => toggled[step.id] ?? (step.status === 'failed' || step.status === 'warning')
  const groups = [
    { title: 'No commit', steps: run.steps.filter((step) => step.kind === 'check' && step.stage === 'commit') },
    { title: 'No push', steps: run.steps.filter((step) => step.kind === 'check' && step.stage === 'push') },
    { title: 'Entrega', steps: run.steps.filter((step) => step.kind !== 'check') },
  ].filter((group) => group.steps.length > 0)
  const tone = run.status === 'passed' ? 'success' : run.status === 'failed' ? 'danger' : 'default'
  const total = (run.finishedAt ?? Date.now()) - run.startedAt

  return (
    <AppCard padding="lg">
      <AppStack gap="lg">
        <AppStack direction="row" justify="between" align="baseline" gap="md" wrap>
          <AppStack gap="xs">
            <AppText variant="caption" tone="secondary">
              {run.mode === 'deploy' ? 'Deploy' : 'Verificação'} · {run.files.length} arquivo(s) no escopo
            </AppText>
            <AppText variant="body" weight="strong" tone={tone}>
              {run.headline}
            </AppText>
          </AppStack>
          <AppText variant="caption" tone="secondary">
            {duration(total)}
          </AppText>
        </AppStack>
        {groups.map((group) => (
          <AppStack key={group.title} gap="xs">
            <SectionLabel>{group.title}</SectionLabel>
            {group.steps.map((step, index) => (
              <Fragment key={step.id}>
                {index > 0 && <AppDivider />}
                <StepRow
                  step={step}
                  open={isOpen(step)}
                  onToggle={() => setToggled((current) => ({ ...current, [step.id]: !isOpen(step) }))}
                />
              </Fragment>
            ))}
          </AppStack>
        ))}
      </AppStack>
    </AppCard>
  )
}

/** O que vai subir: onde o repositório está em relação a origin/main. */
function Scope({ overview }: { overview: DeployOverview }) {
  const [showFiles, setShowFiles] = useState(false)
  const parts = [
    `${overview.branch} · ${overview.head.sha} ${overview.head.subject || '(sem mensagem)'}`,
    overview.ahead ? `${overview.ahead} commit(s) à frente de origin/main` : null,
    overview.behind ? `${overview.behind} atrás` : null,
  ].filter(Boolean)
  return (
    <AppStack gap="xs">
      <AppText variant="bodySmall" tone="secondary">
        {parts.join(' · ')}
      </AppText>
      {overview.changes.length > 0 ? (
        <AppStack gap="xs">
          <Box component="button" type="button" onClick={() => setShowFiles((value) => !value)} sx={{ all: 'unset', cursor: 'pointer', alignSelf: 'flex-start' }}>
            <AppText variant="bodySmall" tone="primary">
              {overview.changes.length} alteração(ões) não commitada(s) {showFiles ? '▴' : '▾'}
            </AppText>
          </Box>
          <AppCollapse open={showFiles}>
            <Log text={overview.changes.map((change) => `${change.status.padEnd(2)}  ${change.path}`).join('\n')} />
          </AppCollapse>
        </AppStack>
      ) : (
        <AppText variant="bodySmall" tone="secondary">
          Nada por commitar
        </AppText>
      )}
    </AppStack>
  )
}

export default function DeployPage() {
  const { overview, error, running, start } = useDeploy()
  const [message, setMessage] = useState('')
  const nothingToShip = overview != null && overview.ahead === 0 && overview.changes.length === 0

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Deploy"
        actions={
          <>
            <AppButton emphasis="outline" disabled={!overview || running} onClick={() => void start('verify', message)}>
              Verificar
            </AppButton>
            <AppButton
              icon={<RocketLaunchOutlinedIcon fontSize="small" />}
              disabled={!overview || running || nothingToShip}
              loading={running && overview?.run?.mode === 'deploy'}
              onClick={() => void start('deploy', message)}
            >
              Deploy
            </AppButton>
          </>
        }
      />

      {error && <AppAlert tone="danger">{error}</AppAlert>}

      {overview && (
        <AppCard padding="lg">
          <AppStack gap="md">
            <Scope overview={overview} />
            <AppTextField
              label="Mensagem do commit"
              placeholder="deploy"
              value={message}
              onChange={setMessage}
              density="comfortable"
            />
          </AppStack>
        </AppCard>
      )}

      {overview?.run ? (
        <Pipeline key={overview.run.id} run={overview.run} />
      ) : (
        overview && (
          <AppText variant="bodySmall" tone="secondary">
            {overview.checks.length} checagens do `.pre-commit-config.yaml` rodam sobre o que difere de origin/main.
            Deploy só commita e envia se nenhuma que bloqueia falhar.
          </AppText>
        )
      )}
    </AppStack>
  )
}
