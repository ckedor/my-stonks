import type {
  RoutineFrequency,
  RoutineGroup,
  RoutineHealth,
  RoutineKey,
  TaskRunStatus,
  TaskRunTrigger,
} from '@/api/operations'

import { INTEGRATIONS_PATH } from '../navigation'

/* Como o painel de operações escreve o que o backend devolve. Os horários
 * são os do worker — Brasília —, não os do navegador de quem olha: "roda às
 * 09:00" precisa ser o mesmo 09:00 que está no agendamento. */

const WORKER_TIME_ZONE = 'America/Sao_Paulo'

/** A tela de cada rotina. `null` para a que só tem o painel: não há o que
 *  configurar nem revisar nela, só disparar e acompanhar. */
export const ROUTINE_PAGES: Record<RoutineKey, string | null> = {
  quotes: `${INTEGRATIONS_PATH}/quotes`,
  market_series: `${INTEGRATIONS_PATH}/market-series`,
  usd_brl: `${INTEGRATIONS_PATH}/usd-brl`,
  fund_share_values: `${INTEGRATIONS_PATH}/fund-share-values`,
  etf_holdings: `${INTEGRATIONS_PATH}/etf-holdings`,
  fund_registry: `${INTEGRATIONS_PATH}/fund-registry`,
  etf_registry: `${INTEGRATIONS_PATH}/etf-registry`,
  asset_catalogue: `${INTEGRATIONS_PATH}/asset-catalogue`,
  company_registry: `${INTEGRATIONS_PATH}/company-registry`,
  fund_links: `${INTEGRATIONS_PATH}/fund-links`,
  portfolio_consolidation: `${INTEGRATIONS_PATH}/consolidation`,
  fii_dividends: null,
  ai_features: '/admin/ai-features',
  execution_history: null,
}

export const GROUP_LABEL: Record<RoutineGroup, string> = {
  market_data: 'Dados de mercado',
  reference_data: 'Cadastros de referência',
  portfolios: 'Carteiras',
  ai: 'IA',
  maintenance: 'Manutenção',
}

export const GROUP_ORDER: RoutineGroup[] = [
  'market_data',
  'reference_data',
  'portfolios',
  'ai',
  'maintenance',
]

export const FREQUENCY_LABEL: Record<RoutineFrequency, string> = {
  intraday: 'Várias vezes ao dia',
  daily: 'Diárias',
  weekly: 'Semanais',
  monthly: 'Mensais',
  other: 'Em datas específicas',
  on_demand: 'Sob demanda',
}

export const FREQUENCY_ORDER: RoutineFrequency[] = [
  'intraday',
  'daily',
  'weekly',
  'monthly',
  'other',
  'on_demand',
]

type ChipTone = 'neutral' | 'primary' | 'success' | 'info' | 'caution' | 'danger'

export const HEALTH: Record<RoutineHealth, { label: string; tone: ChipTone; hint: string }> = {
  ok: { label: 'Em dia', tone: 'success', hint: 'A última execução terminou bem.' },
  warning: {
    label: 'Com falhas parciais',
    tone: 'caution',
    hint: 'Terminou, mas parte dos itens ou das tarefas que ela disparou falhou.',
  },
  failing: { label: 'Falhou', tone: 'danger', hint: 'A última execução falhou.' },
  running: { label: 'Rodando', tone: 'info', hint: 'Há uma execução em andamento.' },
  missed: {
    label: 'Não rodou',
    tone: 'danger',
    hint: 'O último horário agendado passou e nada começou: o worker ou o agendador pode estar parado.',
  },
  never: { label: 'Nunca rodou', tone: 'neutral', hint: 'Não há execução registrada.' },
  on_demand: {
    label: 'Sob demanda',
    tone: 'neutral',
    hint: 'Não é agendada: roda quando alguém dispara.',
  },
}

export const RUN_STATUS: Record<TaskRunStatus, { label: string; tone: ChipTone }> = {
  running: { label: 'Rodando', tone: 'info' },
  success: { label: 'Sucesso', tone: 'success' },
  failure: { label: 'Falhou', tone: 'danger' },
}

export const TRIGGER_LABEL: Record<TaskRunTrigger, string> = {
  scheduled: 'Agendada',
  manual: 'Manual',
  chained: 'Encadeada',
}

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  timeZone: WORKER_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const timeOnly = new Intl.DateTimeFormat('pt-BR', {
  timeZone: WORKER_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})

const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: WORKER_TIME_ZONE })

/** "hoje 09:00", "amanhã 05:00" ou a data: o que se lê numa agenda. */
export function formatWhen(value: string | null | undefined, now = new Date()): string {
  if (!value) return '—'
  const moment = new Date(value)
  const day = dayKey.format(moment)
  if (day === dayKey.format(now)) return `hoje ${timeOnly.format(moment)}`
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  if (day === dayKey.format(tomorrow)) return `amanhã ${timeOnly.format(moment)}`
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (day === dayKey.format(yesterday)) return `ontem ${timeOnly.format(moment)}`
  return dateTime.format(moment)
}

/** "há 3 h", "em 20 min". */
export function formatRelative(value: string | null | undefined, now = new Date()): string {
  if (!value) return '—'
  const minutes = Math.round((new Date(value).getTime() - now.getTime()) / 60_000)
  const size = Math.abs(minutes)
  const amount =
    size < 1
      ? 'menos de 1 min'
      : size < 60
        ? `${size} min`
        : size < 48 * 60
          ? `${Math.round(size / 60)} h`
          : `${Math.round(size / (24 * 60))} dias`
  return minutes >= 0 ? `em ${amount}` : `há ${amount}`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 1) return '< 1 s'
  if (seconds < 60) return `${Math.round(seconds)} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ${Math.round(seconds % 60)} s`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}
