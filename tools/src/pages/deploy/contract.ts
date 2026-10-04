/* O que o painel de deploy e o dev server trocam.
 *
 * Quem roda os comandos é o plugin do Vite em `dev-server/deploy-runner.ts`
 * (`apply: 'serve'`): só existe com `npm run dev`, e o build de produção não
 * tem nem a rota nem o código. Este arquivo não importa nada de Node, porque
 * os dois lados o leem. */

export const DEPLOY_ENDPOINT = '/__dev/deploy'

export type DeployMode = 'verify' | 'deploy'

/** `warning`: um check que não bloqueia e que, por dentro, falhou — o pytest
 *  e o lint-imports rodam com `|| true`, e o pre-commit os diz "Passed". */
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'warning' | 'skipped'

export interface DeployStep {
  id: string
  label: string
  kind: 'check' | 'commit' | 'push'
  /** Falhar aqui impede o commit e o push. */
  blocking: boolean
  /** Onde o check roda no fluxo do terminal: no commit ou só no push. */
  stage?: 'commit' | 'push'
  status: StepStatus
  /** Uma linha: o que se precisa saber sem abrir a saída. */
  summary: string
  output: string
  startedAt?: number
  durationMs?: number
}

export interface DeployRun {
  id: number
  mode: DeployMode
  status: 'running' | 'passed' | 'failed'
  /** A frase do resultado: "Enviado: 4d74f87 em origin/main", "Parou em knip". */
  headline: string
  startedAt: number
  finishedAt?: number
  /** Os arquivos que as checagens olharam: o que difere de origin/main. */
  files: string[]
  steps: DeployStep[]
}

export interface ChangedFile {
  /** O código de `git status --porcelain`: M, A, D, R, ??. */
  status: string
  path: string
}

export interface DeployOverview {
  branch: string
  head: { sha: string; subject: string }
  /** Commits locais que ainda não estão em origin/main, e o contrário. */
  ahead: number
  behind: number
  /** O que ainda não foi commitado. */
  changes: ChangedFile[]
  checks: { id: string; label: string; blocking: boolean; stage: 'commit' | 'push' }[]
  /** A execução em curso, ou a última. */
  run: DeployRun | null
}
