#!/usr/bin/env node
/* ──────────────────────────────────────────────
   Ratchet do design system
   ──────────────────────────────────────────────

   O ESLint sozinho já impede que a dívida cresça em arquivo novo: quem não
   está no baseline é bloqueado. Falta o outro lado — garantir que a lista
   encolha e que ninguém a aumente. É o que este script faz.

   Três verificações:

     1. ÓRFÃO   — arquivo listado que não existe mais.
     2. OBSOLETO— arquivo listado que já não viola nada. Precisa sair da
                  lista, senão a dívida some do código mas fica registrada
                  e a métrica mente.
     3. AUMENTO — arquivo que entrou na lista em relação ao último commit.
                  A lista é ratchet: só desce.

   Roda em `npm run lint:ds` e no pre-commit. */

import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = 'eslint-ds-baseline.json'
const baselinePath = path.join(frontendDir, BASELINE)

const red = (s) => `\x1b[31m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`

/** Conjunto real de arquivos que violam as regras, ignorando as isenções. */
function actualViolations() {
  let raw
  try {
    raw = execFileSync('npx', ['eslint', '.', '--format', 'json'], {
      cwd: frontendDir,
      env: { ...process.env, DS_BASELINE_OFF: '1' },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch (err) {
    // ESLint sai com código 1 quando encontra erros — que é o caso esperado
    // enquanto houver dívida. Só o stdout vazio indica falha real.
    if (!err.stdout) throw err
    raw = err.stdout
  }

  const dsRules = new Set(['no-restricted-imports', 'no-restricted-syntax'])
  return new Set(
    JSON.parse(raw)
      .filter((f) => f.messages.some((m) => dsRules.has(m.ruleId)))
      .map((f) => path.relative(frontendDir, f.filePath)),
  )
}

/** Baseline como estava no último commit, para detectar aumento. */
function committedBaseline() {
  try {
    const raw = execFileSync('git', ['show', `HEAD:frontend/${BASELINE}`], {
      cwd: frontendDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return new Set(JSON.parse(raw).files)
  } catch {
    // Primeiro commit do baseline, ou fora de um repositório git.
    return null
  }
}

const baseline = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).files)
const actual = actualViolations()
const previous = committedBaseline()

const problems = []

const orphans = [...baseline].filter((f) => !existsInRepo(f))
if (orphans.length) {
  problems.push(
    `${red('Órfãos')} — listados em ${BASELINE} mas o arquivo não existe:\n` +
      orphans.map((f) => `    ${f}`).join('\n'),
  )
}

const stale = [...baseline].filter((f) => existsInRepo(f) && !actual.has(f))
if (stale.length) {
  problems.push(
    `${red('Obsoletos')} — já não violam nada. Remova de ${BASELINE}:\n` +
      stale.map((f) => `    ${f}`).join('\n'),
  )
}

if (previous) {
  const added = [...baseline].filter((f) => !previous.has(f))
  if (added.length) {
    problems.push(
      `${red('Aumento')} — a lista só pode encolher. Entraram desde o último commit:\n` +
        added.map((f) => `    ${f}`).join('\n') +
        `\n  Migre o arquivo para "@/components/ui" em vez de isentá-lo.`,
    )
  }
}

if (problems.length) {
  console.error(`\n${red('✖')} Ratchet do design system\n`)
  problems.forEach((p) => console.error(`  ${p}\n`))
  process.exit(1)
}

const migrated = previous ? previous.size - baseline.size : 0
const progress = migrated > 0 ? yellow(`  (−${migrated} desde o último commit)`) : ''
console.log(`${green('✔')} Design system: ${baseline.size} arquivo(s) na dívida${progress}`)

function existsInRepo(relPath) {
  try {
    readFileSync(path.join(frontendDir, relPath))
    return true
  } catch {
    return false
  }
}
