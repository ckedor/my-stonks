import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Plugin } from 'vite'
import {
  DEPLOY_ENDPOINT,
  type ChangedFile,
  type DeployMode,
  type DeployOverview,
  type DeployRun,
  type DeployStep,
} from '../src/pages/deploy/contract.ts'

/* O CI do painel de deploy, rodando no dev server.
 *
 * O repositório não tem CI remoto: os hooks do `.pre-commit-config.yaml` são
 * o CI (ver o cabeçalho dele). Este runner roda os mesmos hooks, um por vez,
 * para que cada um tenha estado, duração e saída próprios — no terminal eles
 * saem numa coluna só, e um "Passed" de quem roda com `|| true` esconde
 * testes vermelhos.
 *
 * O pipeline:
 *
 *   1. Checagens, sobre o que vai subir: os arquivos que diferem de
 *      origin/main, commitados ou não, mais os novos. É o escopo que o
 *      commit e o push dariam aos hooks, sem precisar commitar antes.
 *   2. Só no deploy, e só se nada que bloqueia falhou: commit de tudo e push
 *      para main. Os dois com `--no-verify`: os hooks acabaram de rodar sobre
 *      exatamente esse conteúdo, e rodá-los de novo dobraria os minutos do
 *      pytest. A garantia de que é o mesmo conteúdo é a impressão da árvore
 *      (`write-tree` de um índice temporário), tirada antes e depois das
 *      checagens: se alguém mexeu num arquivo no meio, nada é commitado.
 *
 * Só existe com `npm run dev` (`apply: 'serve'`). Os comandos são fixos aqui;
 * do navegador chega o modo e a mensagem do commit, e nada mais. */

/** O fim da saída de cada passo: um pytest inteiro passa disso. */
const MAX_OUTPUT = 200_000

/** Uma falha que aparece por dentro de um check que não bloqueia. */
const HIDDEN_FAILURE = /\b([1-9]\d*) (failed|broken|errors?)\b/

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g

interface CheckDef {
  id: string
  label: string
  blocking: boolean
  stage: 'commit' | 'push'
}

interface Result {
  code: number
  output: string
}

function exec(
  root: string,
  command: string,
  args: string[],
  options: { env?: Record<string, string>; onOutput?: (chunk: string) => void } = {},
): Promise<Result> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      env: {
        ...process.env,
        // Sem terminal para digitar senha: um push sem credencial falha na
        // hora, em vez de esperar para sempre.
        GIT_TERMINAL_PROMPT: '0',
        ...options.env,
      },
    })
    let output = ''
    const take = (data: Buffer) => {
      const chunk = data.toString().replace(ANSI, '')
      output = (output + chunk).slice(-MAX_OUTPUT)
      options.onOutput?.(chunk)
    }
    child.stdout.on('data', take)
    child.stderr.on('data', take)
    child.on('error', (error) => resolve({ code: 127, output: `${output}${error.message}\n` }))
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
  })
}

async function git(root: string, args: string[], env?: Record<string, string>) {
  const result = await exec(root, 'git', args, { env })
  if (result.code !== 0) throw new Error(`git ${args.join(' ')}: ${result.output.trim()}`)
  return result.output.trim()
}

/** Os hooks, na ordem do arquivo. Bloqueia o que não termina em `|| true`. */
export function readChecks(root: string): CheckDef[] {
  const config = fs.readFileSync(path.join(root, '.pre-commit-config.yaml'), 'utf8')
  return config
    .split(/\n\s*- id: /)
    .slice(1)
    .map((block) => {
      const id = block.split('\n')[0].trim()
      const name = /\n\s*name: (.+)/.exec(block)?.[1].trim() ?? id
      const entry = /\n\s*entry: (.+)/.exec(block)?.[1] ?? ''
      const stages = /\n\s*stages: \[([^\]]*)\]/.exec(block)?.[1] ?? ''
      return {
        id,
        // O que o nome diz entre parênteses o painel mostra de outro jeito.
        label: name.replace(/\s*\((staged files|não bloqueia)\)/g, ''),
        blocking: !entry.includes('|| true'),
        stage: stages.includes('pre-push') && !stages.includes('pre-commit') ? 'push' : 'commit',
      } satisfies CheckDef
    })
}

/** O conteúdo da árvore de trabalho, como o commit o gravaria. */
async function treeFingerprint(root: string) {
  const index = path.join(os.tmpdir(), `my-stonks-deploy-${process.pid}.index`)
  try {
    fs.copyFileSync(path.join(root, '.git', 'index'), index)
    const env = { GIT_INDEX_FILE: index }
    await git(root, ['add', '-A'], env)
    return await git(root, ['write-tree'], env)
  } finally {
    fs.rmSync(index, { force: true })
  }
}

/** O que as checagens olham: tudo o que difere de origin/main. */
async function filesInScope(root: string) {
  const changed = await git(root, ['diff', '--name-only', '--diff-filter=d', 'origin/main'])
  const untracked = await git(root, ['ls-files', '--others', '--exclude-standard'])
  return [...new Set([...changed.split('\n'), ...untracked.split('\n')].filter(Boolean))].sort()
}

/** Uma linha que diz o resultado, tirada da saída de cada ferramenta. */
function summarize(body: string, status: DeployStep['status'], modified: boolean) {
  if (status === 'skipped') return 'Nada a checar: nenhum arquivo do escopo mudou'
  if (modified) return 'Alterou arquivos ao corrigir — revise e rode de novo'
  const lines = body
    .split('\n')
    .map((line) => line.replace(/^=+\s*|\s*=+$/g, '').trim())
    .filter(Boolean)
  const pytest = lines.findLast((line) => /\d+ (passed|failed)/.test(line))
  if (pytest) return pytest.replace(/ in [\d.]+s.*$/, '')
  const contracts = lines.find((line) => line.startsWith('Contracts:'))
  if (contracts) return contracts.replace(/\.$/, '')
  const knip = lines.filter((line) => /^(Unused|Duplicate|Unlisted|Unresolved)[^(]*\(\d+\)$/.test(line))
  if (knip.length) return knip.join(' · ')
  const built = lines.find((line) => /built in [\d.]+m?s/.test(line))
  if (built) return built
  const mark = lines.find((line) => /^[✓✔✗✖]/.test(line))
  if (mark) return mark
  return lines.at(-1)?.slice(0, 160) ?? ''
}

/** Lê o que o `pre-commit run` de um hook só imprimiu. */
function readHookResult(check: CheckDef, result: Result) {
  const lines = result.output.split('\n')
  const verdict = /(Passed|Failed|Skipped)\s*$/.exec(lines[0] ?? '')?.[1]
  const modified = result.output.includes('- files were modified by this hook')
  const body = lines
    .slice(1)
    .filter((line) => !/^- (hook id|duration|exit code|files were modified)/.test(line))
    .join('\n')
    .trim()
  let status: DeployStep['status'] =
    verdict === 'Passed' ? 'passed' : verdict === 'Skipped' ? 'skipped' : 'failed'
  if (status === 'passed' && !check.blocking && HIDDEN_FAILURE.test(body)) status = 'warning'
  return { status, summary: summarize(body, status, modified), output: body || result.output.trim() }
}

function pushFailure(output: string) {
  if (/could not read Username|Authentication failed|terminal prompts disabled/i.test(output)) {
    return 'Sem credencial do GitHub neste processo: rode `gh auth setup-git` (ou configure um credential helper) e reinicie o dev server'
  }
  if (/rejected|fetch first|non-fast-forward/i.test(output)) {
    return 'origin/main andou: faça pull e rode de novo'
  }
  return output.trim().split('\n').at(-1) ?? 'O push falhou'
}

class DeployRunner {
  private current: DeployRun | null = null
  private nextId = 1

  constructor(private readonly root: string) {}

  async overview(): Promise<DeployOverview> {
    const [branch, head, counts, status] = await Promise.all([
      git(this.root, ['rev-parse', '--abbrev-ref', 'HEAD']),
      git(this.root, ['log', '-1', '--format=%h%x00%s']),
      git(this.root, ['rev-list', '--left-right', '--count', 'origin/main...HEAD']),
      git(this.root, ['status', '--porcelain=v1', '-uall']),
    ])
    const [sha, subject] = head.split('\0')
    const [behind, ahead] = counts.split(/\s+/).map(Number)
    const changes: ChangedFile[] = status
      .split('\n')
      .filter(Boolean)
      .map((line) => ({ status: line.slice(0, 2).trim(), path: line.slice(3) }))
    return {
      branch,
      head: { sha, subject },
      ahead,
      behind,
      changes,
      checks: readChecks(this.root),
      run: this.current,
    }
  }

  start(mode: DeployMode, message: string): DeployRun {
    if (this.current?.status === 'running') throw new Error('Já há uma execução em curso.')
    const checks = readChecks(this.root)
    const run: DeployRun = {
      id: this.nextId++,
      mode,
      status: 'running',
      headline: 'Preparando',
      startedAt: Date.now(),
      files: [],
      steps: [
        ...checks.map((check) => ({
          id: check.id,
          label: check.label,
          kind: 'check' as const,
          blocking: check.blocking,
          stage: check.stage,
          status: 'pending' as const,
          summary: '',
          output: '',
        })),
        ...(mode === 'deploy'
          ? [
              { id: 'commit', label: 'Commit', kind: 'commit' as const },
              { id: 'push', label: 'Push para main', kind: 'push' as const },
            ].map((step) => ({ ...step, blocking: true, status: 'pending' as const, summary: '', output: '' }))
          : []),
      ],
    }
    this.current = run
    void this.execute(run, checks, message.trim() || 'deploy').catch((error: unknown) => {
      run.status = 'failed'
      run.headline = error instanceof Error ? error.message : String(error)
      run.finishedAt = Date.now()
    })
    return run
  }

  private async step<T>(step: DeployStep, work: () => Promise<T>) {
    step.status = 'running'
    step.startedAt = Date.now()
    try {
      return await work()
    } finally {
      step.durationMs = Date.now() - step.startedAt
    }
  }

  private async execute(run: DeployRun, checks: CheckDef[], message: string) {
    const steps = new Map(run.steps.map((step) => [step.id, step]))
    const before = await treeFingerprint(this.root)
    run.files = await filesInScope(this.root)

    for (const [index, check] of checks.entries()) {
      const step = steps.get(check.id)!
      run.headline = `Checando ${index + 1} de ${checks.length}: ${check.label}`
      await this.step(step, async () => {
        const result = await exec(
          this.root,
          'pre-commit',
          ['run', check.id, '--hook-stage', 'pre-push', '--color', 'never', ...(run.files.length ? ['--files', ...run.files] : [])],
          { onOutput: (chunk) => (step.output = (step.output + chunk).slice(-MAX_OUTPUT)) },
        )
        Object.assign(step, readHookResult(check, result))
      })
    }

    const blockers = run.steps.filter((step) => step.kind === 'check' && step.blocking && step.status === 'failed')
    const warnings = run.steps.filter((step) => step.status === 'warning')
    const finish = (status: DeployRun['status'], headline: string) => {
      run.status = status
      run.headline = headline
      run.finishedAt = Date.now()
    }
    const blockedBy = blockers.map((step) => step.label).join(', ')

    if (run.mode === 'verify') {
      if (blockers.length) finish('failed', `Não sobe: ${blockedBy} falhou`)
      else finish('passed', warnings.length ? 'Pode subir, com avisos que não bloqueiam' : 'Pode subir: tudo passou')
      return
    }

    const commit = steps.get('commit')!
    const push = steps.get('push')!
    if (blockers.length) {
      for (const step of [commit, push]) {
        step.status = 'skipped'
        step.summary = `Não feito: ${blockedBy} falhou`
      }
      finish('failed', `Parou: ${blockedBy} falhou. Nada foi commitado nem enviado.`)
      return
    }

    const committed = await this.step(commit, async () => {
      if ((await treeFingerprint(this.root)) !== before) {
        commit.status = 'failed'
        commit.summary = 'Arquivos mudaram durante as checagens: rode de novo'
        return false
      }
      if (!(await git(this.root, ['status', '--porcelain']))) {
        commit.status = 'skipped'
        commit.summary = 'Nada a commitar: sobem os commits que já existem'
        return true
      }
      await git(this.root, ['add', '-A'])
      const result = await exec(this.root, 'git', ['commit', '--no-verify', '-m', message])
      commit.output = result.output.trim()
      if (result.code !== 0) {
        commit.status = 'failed'
        commit.summary = result.output.trim().split('\n').at(-1) ?? 'O commit falhou'
        return false
      }
      commit.status = 'passed'
      commit.summary = await git(this.root, ['log', '-1', '--format=%h %s'])
      return true
    })
    if (!committed) {
      push.status = 'skipped'
      push.summary = 'Não feito: o commit não aconteceu'
      finish('failed', 'Parou no commit. Nada foi enviado.')
      return
    }

    await this.step(push, async () => {
      const result = await exec(this.root, 'git', ['push', '--no-verify', 'origin', 'HEAD:main'])
      push.output = result.output.trim()
      if (result.code === 0) {
        push.status = 'passed'
        push.summary = `origin/main em ${await git(this.root, ['rev-parse', '--short', 'HEAD'])}`
      } else {
        push.status = 'failed'
        push.summary = pushFailure(result.output)
      }
    })
    if (push.status === 'passed') {
      finish('passed', warnings.length ? `Enviado, com avisos — ${push.summary}` : `Enviado — ${push.summary}`)
    } else {
      finish('failed', 'O commit foi feito, mas o push falhou.')
    }
  }
}

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function deployRunner(root: string): Plugin {
  const runner = new DeployRunner(root)
  return {
    name: 'deploy-runner',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(DEPLOY_ENDPOINT, (req, res) => {
        if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
          runner.overview().then(
            (overview) => json(res, 200, overview),
            (error: unknown) => json(res, 500, { message: String(error) }),
          )
          return
        }
        if (req.method === 'POST' && req.url === '/run') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', () => {
            try {
              const { mode, message } = JSON.parse(body || '{}') as { mode?: string; message?: string }
              if (mode !== 'verify' && mode !== 'deploy') throw new Error('Modo desconhecido.')
              json(res, 202, runner.start(mode, String(message ?? '')))
            } catch (error) {
              json(res, 409, { message: error instanceof Error ? error.message : String(error) })
            }
          })
          return
        }
        json(res, 404, { message: 'Rota desconhecida.' })
      })
    },
  }
}
