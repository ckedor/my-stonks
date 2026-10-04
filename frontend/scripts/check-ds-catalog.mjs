#!/usr/bin/env node
/* ──────────────────────────────────────────────
   Guarda do design system: todo componente tem consumidor
   ──────────────────────────────────────────────

   Um componente exportado por `@/components/ui` que nenhuma tela usa é
   código morto — o knip não o acusa, porque o `index.ts` do design system é
   entry point dele. Esta guarda reprova cada componente exportado que nenhum
   arquivo de `src/` fora do design system e dos testes importa.

   O catálogo do design system mora em `tools/`, fora do app, e não conta
   como consumidor: o que só o catálogo usa sai daqui.

   Antes de olhar o código, a guarda roda contra um caso inventado em que
   ela tem de falhar. Se não falhar, ela parou de casar, e diz isso em vez
   de passar verde sem cobrir nada.

   Roda em `npm run lint:catalog` e no pre-commit. */

import path from 'node:path'
import { componentExports, dsImports, DS_DIR, isConsumer, read, sourceFiles } from './ds-usage.mjs'

/** A verificação, sem disco: recebe os arquivos já lidos. */
function findProblems({ exports, consumerFiles }) {
  const consumed = new Set(consumerFiles.flatMap((file) => [...dsImports(file.path, file.source)]))
  return exports
    .filter((name) => !consumed.has(name))
    .map((name) => `${name} não é importado por nenhuma tela ou componente — apague-o`)
}

/* O caso inventado: um componente exportado que ninguém importa tem de dar a
   reclamação, e o mesmo componente importado por uma tela, nenhuma. Se uma
   das duas não acontecer, o que mudou foi a guarda — um seletor da AST que
   deixou de casar, por exemplo. */
function guardStillFires() {
  const source = "import { AppFantasma } from '@/components/ui'\nexport default () => <AppFantasma />\n"
  const missing = findProblems({ exports: ['AppFantasma'], consumerFiles: [] })
  const present = findProblems({
    exports: ['AppFantasma'],
    consumerFiles: [{ path: 'Screen.tsx', source }],
  })
  return missing.some((problem) => problem.startsWith('AppFantasma')) && present.length === 0
}

const red = (s) => `\x1b[31m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`

if (!guardStillFires()) {
  console.error(`\n${red('✖')} A guarda do design system não reprovou o caso inventado: ela parou de casar.`)
  console.error('  Revise scripts/check-ds-catalog.mjs e scripts/ds-usage.mjs antes de confiar nela.\n')
  process.exit(1)
}

const exports = componentExports(read(path.posix.join(DS_DIR, 'index.ts')))
const problems = findProblems({
  exports,
  consumerFiles: sourceFiles()
    .filter(isConsumer)
    .map((file) => ({ path: file, source: read(file) })),
})

if (problems.length) {
  console.error(`\n${red('✖')} Design system: componente sem consumidor\n`)
  problems.forEach((problem) => console.error(`    ${problem}`))
  console.error('')
  process.exit(1)
}

console.log(`${green('✔')} Design system: ${exports.length} componente(s), todos com consumidor`)
