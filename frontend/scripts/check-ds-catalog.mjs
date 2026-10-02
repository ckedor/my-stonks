#!/usr/bin/env node
/* ──────────────────────────────────────────────
   Guarda do catálogo do design system
   ──────────────────────────────────────────────

   O catálogo (`/admin/design-system`) só serve para reduzir a superfície se
   estiver completo: um componente que não aparece lá não é comparado com
   os vizinhos, e a duplicação volta por ele. E um componente que só o
   catálogo usa é código morto com vitrine — o knip não o acusa, porque o
   `index.ts` do design system é entry point dele.

   Três verificações, sobre cada componente exportado por `@/components/ui`:

     1. CATÁLOGO   — é renderizado em `src/pages/admin/design-system/`, ou
                     está em EXCEPTIONS com o motivo.
     2. CONSUMIDOR — algum arquivo fora do design system, do catálogo e dos
                     testes o importa. Sem consumidor, ele sai.
     3. EXCEÇÃO    — cada entrada de EXCEPTIONS ainda é um componente
                     exportado e ainda está fora do catálogo. Exceção que
                     sobrou é dívida registrada que não existe mais.

   Antes de olhar o código, a guarda roda contra um caso inventado em que
   ela tem de falhar. Se não falhar, ela parou de casar, e diz isso em vez
   de passar verde sem cobrir nada.

   Roda em `npm run lint:catalog` e no pre-commit. */

import path from 'node:path'
import {
  CATALOG_DIR,
  componentExports,
  dsImports,
  DS_DIR,
  isConsumer,
  jsxUses,
  read,
  sourceFiles,
} from './ds-usage.mjs'

/** Fora do catálogo, com o motivo. Cada linha aqui é uma decisão, não um
 *  esquecimento: a verificação 3 tira a que deixar de valer. */
const EXCEPTIONS = {
  AppShell: 'casca do admin: ocupa a tela inteira, e a página do catálogo já está dentro dela',
  AppPageShell: 'casca das telas do produto: ocupa a tela inteira',
  AppSplitScreen: 'tela de entrada dividida ao meio: ocupa a tela inteira',
  AppTopbar: 'barra do topo do app: aparece em toda tela, inclusive nesta',
  AppSidebar: 'menu lateral do admin: aparece em toda tela do admin, inclusive nesta',
  AppNavRail: 'coluna de navegação do produto: aparece em toda tela do produto',
  AppNavDrawer: 'gaveta de navegação do celular: só abre na casca do produto',
  LoadingSpinner: 'a regra do ESLint o reprova em src/pages/**; aparece pelo loading do AppButton',
}

/** As três verificações, sem disco: recebe os arquivos já lidos. */
function findProblems({ exports, catalogFiles, consumerFiles, exceptions }) {
  const rendered = new Set(
    catalogFiles
      .filter((file) => file.path.endsWith('.tsx'))
      .flatMap((file) => jsxUses(file.path, file.source).map((use) => use.name)),
  )
  const consumed = new Set(consumerFiles.flatMap((file) => [...dsImports(file.path, file.source)]))
  const exported = new Set(exports)
  const problems = []

  for (const name of exports) {
    if (!rendered.has(name) && !(name in exceptions)) {
      problems.push(`catálogo: ${name} não aparece em ${CATALOG_DIR} nem em EXCEPTIONS`)
    }
    if (!consumed.has(name)) {
      problems.push(`consumidor: ${name} não é importado por nenhuma tela ou componente — apague-o`)
    }
  }
  for (const name of Object.keys(exceptions)) {
    if (!exported.has(name)) problems.push(`exceção: ${name} não é mais exportado — tire de EXCEPTIONS`)
    else if (rendered.has(name)) problems.push(`exceção: ${name} já está no catálogo — tire de EXCEPTIONS`)
  }
  return problems
}

/* O caso inventado: um componente exportado que ninguém renderiza nem
   importa tem de dar as duas reclamações, e o mesmo componente renderizado
   e importado não pode dar nenhuma. Se uma das duas metades mudar, quem
   mudou foi a guarda — um seletor da AST que deixou de casar, por exemplo. */
function guardStillFires() {
  const source = "import { AppFantasma } from '@/components/ui'\nexport default () => <AppFantasma />\n"
  const missing = findProblems({
    exports: ['AppFantasma'],
    catalogFiles: [],
    consumerFiles: [],
    exceptions: {},
  })
  const present = findProblems({
    exports: ['AppFantasma'],
    catalogFiles: [{ path: 'Catalog.tsx', source }],
    consumerFiles: [{ path: 'Screen.tsx', source }],
    exceptions: {},
  })
  return (
    missing.some((problem) => problem.startsWith('catálogo: AppFantasma')) &&
    missing.some((problem) => problem.startsWith('consumidor: AppFantasma')) &&
    present.length === 0
  )
}

const red = (s) => `\x1b[31m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`

if (!guardStillFires()) {
  console.error(`\n${red('✖')} A guarda do catálogo não reprovou o caso inventado: ela parou de casar.`)
  console.error('  Revise scripts/check-ds-catalog.mjs e scripts/ds-usage.mjs antes de confiar nela.\n')
  process.exit(1)
}

const files = sourceFiles()
const exports = componentExports(read(path.posix.join(DS_DIR, 'index.ts')))
const problems = findProblems({
  exports,
  catalogFiles: files.filter((file) => file.startsWith(CATALOG_DIR)).map((file) => ({ path: file, source: read(file) })),
  consumerFiles: files.filter(isConsumer).map((file) => ({ path: file, source: read(file) })),
  exceptions: EXCEPTIONS,
})

if (problems.length) {
  console.error(`\n${red('✖')} Catálogo do design system\n`)
  problems.forEach((problem) => console.error(`    ${problem}`))
  console.error('')
  process.exit(1)
}

const catalogued = exports.length - Object.keys(EXCEPTIONS).length
console.log(`${green('✔')} Design system: ${catalogued} componente(s) no catálogo, ${Object.keys(EXCEPTIONS).length} exceção(ões)`)
