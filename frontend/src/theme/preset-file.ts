/* Gravar um preset em `presets.ts`, como texto.
 *
 * O estúdio de temas salva direto no arquivo: editar um preset reescreve o
 * bloco dele, e um preset novo entra como constante e na lista. Quem grava é
 * o dev server (`vite.config.ts`), que só existe com `npm run dev`; o commit
 * continua sendo o que publica o tema.
 *
 * É manipulação de texto, e não de AST, porque `presets.ts` é escrito à mão,
 * com comentário longo entre um preset e outro, e reformatar o arquivo inteiro
 * a cada salvamento apagaria o que ninguém pediu para mudar. Só o bloco do
 * preset é trocado. Tudo o que não casa com o esperado — id que não existe,
 * id repetido, lista que não está onde estava — falha alto em vez de gravar
 * pela metade.
 *
 * Sem imports: o `vite.config.ts` carrega este arquivo fora do app. */

export const PRESET_FILE_ENDPOINT = '/__dev/theme-presets'

export type PresetFileChange =
  /** Reescreve o preset `id`. O id não muda: ele fica no navegador de quem
   *  escolheu o tema, e trocá-lo troca o tema dessa pessoa pelo padrão. */
  | { kind: 'update'; id: string; source: string }
  /** Acrescenta um preset, no fim dos claros ou dos escuros. */
  | { kind: 'add'; id: string; name: string; mode: 'light' | 'dark'; source: string }

const ARRAY_START = 'export const THEME_PRESETS: ThemePreset[] = ['
const PRESET_CONST = /^const (\w+): ThemePreset = \{/gm
const ID_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface PresetBlock {
  name: string
  id: string
  mode: 'light' | 'dark'
  /** Do `{` ao `}` do objeto, inclusive. */
  start: number
  end: number
  source: string
}

function skipString(text: string, start: number): number {
  const quote = text[start]
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') i++
    else if (text[i] === quote) return i
  }
  throw new Error('presets.ts: string sem fim')
}

/** O `}` que fecha o `{` em `open`, pulando strings e comentários. */
function matchingBrace(text: string, open: number): number {
  let depth = 0
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (c === "'" || c === '"' || c === '`') i = skipString(text, i)
    else if (c === '/' && text[i + 1] === '/') i = text.indexOf('\n', i)
    else if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i)
      i = close < 0 ? -1 : close + 1
    } else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
    if (i < 0) break
  }
  throw new Error('presets.ts: chave sem par')
}

/** Os presets escritos como `const x: ThemePreset = { ... }`, na ordem do
 *  arquivo. */
export function presetBlocks(text: string): PresetBlock[] {
  return [...text.matchAll(PRESET_CONST)].map((match) => {
    const start = match.index + match[0].length - 1
    const end = matchingBrace(text, start)
    const source = text.slice(start, end + 1)
    const id = /^ {2}id: '([^']+)'/m.exec(source)?.[1]
    const mode = /mode: '(light|dark)'/.exec(source)?.[1] as PresetBlock['mode'] | undefined
    if (!id || !mode) throw new Error(`presets.ts: ${match[1]} sem id ou sem modo`)
    return { name: match[1], id, mode, start, end, source }
  })
}

function sourceId(source: string): string | undefined {
  return /^ {2}id: '([^']+)'/m.exec(source)?.[1]
}

function camelCase(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

function updatePreset(text: string, change: Extract<PresetFileChange, { kind: 'update' }>): string {
  const matches = presetBlocks(text).filter((block) => block.id === change.id)
  if (matches.length !== 1) {
    throw new Error(`presets.ts: ${matches.length} presets com o id "${change.id}"`)
  }
  if (sourceId(change.source) !== change.id) {
    throw new Error(`o id de um preset publicado não muda: "${change.id}"`)
  }
  const [block] = matches
  return text.slice(0, block.start) + change.source + text.slice(block.end + 1)
}

function addPreset(text: string, change: Extract<PresetFileChange, { kind: 'add' }>): string {
  if (!ID_FORMAT.test(change.id)) {
    throw new Error(`id inválido: "${change.id}" — só minúsculas, números e hífen`)
  }
  if (sourceId(change.source) !== change.id) {
    throw new Error(`a definição não tem o id "${change.id}"`)
  }
  const blocks = presetBlocks(text)
  if (blocks.some((block) => block.id === change.id)) {
    throw new Error(`já existe um preset com o id "${change.id}"`)
  }
  const name = camelCase(change.id)
  if (new RegExp(`^(const|let|function) ${name}\\b`, 'm').test(text)) {
    throw new Error(`presets.ts já tem um "${name}"`)
  }

  const arrayStart = text.indexOf(ARRAY_START)
  if (arrayStart < 0) throw new Error('presets.ts: a lista THEME_PRESETS sumiu')
  const arrayOpen = arrayStart + ARRAY_START.length - 1
  const arrayClose = text.indexOf(']', arrayOpen)
  const entries = text.slice(arrayOpen + 1, arrayClose).match(/\w+/g) ?? []
  const modeOf = new Map(blocks.map((block) => [block.name, block.mode]))
  // Os claros e depois os escuros: o novo entra no fim do grupo dele.
  const firstDark = entries.findIndex((entry) => modeOf.get(entry) === 'dark')
  const at = change.mode === 'light' && firstDark >= 0 ? firstDark : entries.length
  const nextEntries = [...entries.slice(0, at), name, ...entries.slice(at)]
  const array = `[\n${nextEntries.map((entry) => `  ${entry},`).join('\n')}\n]`

  // A constante entra antes do comentário da lista, que é dela.
  const doc = text.lastIndexOf('/**', arrayStart)
  const insertAt = doc >= 0 && text.slice(doc, arrayStart).trimEnd().endsWith('*/') ? doc : arrayStart
  const title = change.name.replace(/\*\//g, '* /')
  const constant = [
    '/* ══════════════════════════════════════════════',
    `   ${title}`,
    '   ══════════════════════════════════════════════ */',
    `const ${name}: ThemePreset = ${change.source}`,
    '',
    '',
  ].join('\n')

  return (
    text.slice(0, insertAt) +
    constant +
    text.slice(insertAt, arrayOpen) +
    array +
    text.slice(arrayClose + 1)
  )
}

export function applyPresetChange(text: string, change: PresetFileChange): string {
  return change.kind === 'update' ? updatePreset(text, change) : addPreset(text, change)
}
