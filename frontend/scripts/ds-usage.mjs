#!/usr/bin/env node
/* ──────────────────────────────────────────────
   Uso do design system
   ──────────────────────────────────────────────

   Lê o código pela AST e responde, para cada componente exportado por
   `@/components/ui`: quantos arquivos o usam e com que valores de prop.
   É o que sustenta uma redução — um componente em um arquivo só, uma
   variante que ninguém pede — sem depender de grep, que não vê a prop na
   linha de baixo.

     npm run ds:usage                     um componente por linha, do menos
                                          usado para o mais usado
     npm run ds:usage -- AppButton AppChip
                                          cada prop de cada um, com a
                                          contagem de cada valor

   Conta só os consumidores: ficam de fora a própria pasta do design system,
   o catálogo (`src/pages/admin/design-system/`) e os testes. O catálogo
   renderiza tudo de propósito, e contado ele faria de todo componente um
   componente usado.

   As funções daqui também servem `scripts/check-ds-catalog.mjs`. */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DS_MODULE = '@/components/ui'
export const DS_DIR = 'src/components/ui/'
export const CATALOG_DIR = 'src/pages/admin/design-system/'

function parse(fileName, source) {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

/** Os componentes que `index.ts` exporta: valor (não tipo), em PascalCase.
 *  Constantes em caixa alta (`SIDEBAR_WIDTH`), hooks e tokens ficam de fora. */
export function componentExports(indexSource) {
  const names = []
  for (const statement of parse('index.ts', indexSource).statements) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue
    const clause = statement.exportClause
    if (!clause || !ts.isNamedExports(clause)) continue
    for (const element of clause.elements) {
      const name = element.name.text
      if (!element.isTypeOnly && /^[A-Z]/.test(name) && /[a-z]/.test(name)) names.push(name)
    }
  }
  return names
}

/** Os nomes que um arquivo importa de `@/components/ui`, sem os de tipo. */
export function dsImports(fileName, source) {
  const names = new Set()
  for (const statement of parse(fileName, source).statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (statement.moduleSpecifier.text !== DS_MODULE) continue
    const clause = statement.importClause
    if (!clause || clause.isTypeOnly) continue
    const bindings = clause.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (!element.isTypeOnly) names.add((element.propertyName ?? element.name).text)
      }
    }
  }
  return names
}

/** Cada `<Componente ...>` de `@/components/ui` no arquivo, com as props.
 *  O valor de uma prop é o literal quando há um, e `{expr}` quando não. */
export function jsxUses(fileName, source) {
  const imported = dsImports(fileName, source)
  const uses = []
  const sourceFile = parse(fileName, source)

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(sourceFile)
      if (imported.has(name)) {
        const props = {}
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue
          props[attribute.name.getText(sourceFile)] = propValue(attribute.initializer, sourceFile)
        }
        uses.push({ name, props })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return uses
}

function propValue(initializer, sourceFile) {
  if (!initializer) return 'true'
  if (ts.isStringLiteral(initializer)) return JSON.stringify(initializer.text)
  const expression = initializer.expression
  if (expression && (ts.isStringLiteral(expression) || ts.isNumericLiteral(expression))) {
    return expression.getText(sourceFile)
  }
  return '{expr}'
}

/** Todo `.ts`/`.tsx` de `src/`, como caminho relativo a `frontend/`. */
export function sourceFiles() {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(path.join(frontendDir, dir))) {
      const relative = path.posix.join(dir, entry)
      if (statSync(path.join(frontendDir, relative)).isDirectory()) walk(relative)
      else if (/\.tsx?$/.test(entry)) files.push(relative)
    }
  }
  walk('src')
  return files
}

/** Arquivo que conta como consumidor: fora do design system, fora do
 *  catálogo, e não teste. */
export const isConsumer = (file) =>
  !file.startsWith(DS_DIR) && !file.startsWith(CATALOG_DIR) && !/\.test\.tsx?$/.test(file)

export const read = (file) => readFileSync(path.join(frontendDir, file), 'utf8')

function report(names) {
  const exports = componentExports(read(`${DS_DIR}index.ts`))
  const usage = new Map(exports.map((name) => [name, { files: new Set(), count: 0, props: {} }]))

  for (const file of sourceFiles().filter(isConsumer)) {
    const source = read(file)
    for (const name of dsImports(file, source)) usage.get(name)?.files.add(file)
    if (!file.endsWith('.tsx')) continue
    for (const use of jsxUses(file, source)) {
      const entry = usage.get(use.name)
      if (!entry) continue
      entry.count += 1
      for (const [prop, value] of Object.entries(use.props)) {
        entry.props[prop] ??= {}
        entry.props[prop][value] = (entry.props[prop][value] ?? 0) + 1
      }
    }
  }

  const rows = [...usage].sort((a, b) => a[1].files.size - b[1].files.size || a[0].localeCompare(b[0]))
  for (const [name, entry] of rows) {
    if (names.length && !names.includes(name)) continue
    console.log(`${String(entry.files.size).padStart(4)} arquivo(s)  ${String(entry.count).padStart(4)} uso(s)  ${name}`)
    if (!names.length) continue
    for (const [prop, values] of Object.entries(entry.props).sort()) {
      const counted = Object.entries(values)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => `${value}×${count}`)
        .join('  ')
      console.log(`        ${prop}: ${counted}`)
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  report(process.argv.slice(2))
}
