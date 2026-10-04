/* Gravar o catálogo do jogo em `frontend/src/components/city-game/catalog.ts`,
 * como texto.
 *
 * O estúdio do jogo muda a categoria, a subcategoria e o preço de uma peça.
 * Cada peça é uma linha do `CITY_CATALOG`, e só os campos dela mudam: o resto
 * da linha, a ordem e os comentários ficam como estavam. O que não casa com o
 * esperado — id que não existe, id em duas linhas, linha fora do formato —
 * falha alto em vez de gravar pela metade.
 *
 * Sem imports: o `vite.config.ts` carrega este arquivo fora do app. */

export const CATALOG_FILE_ENDPOINT = '/__dev/city-catalog'

/** O estado final dos campos editáveis de uma peça. `price: null` volta ao
 *  preço calculado pelo volume. */
export interface CatalogItemChange {
  id: string
  group: string
  subgroup: string
  price: number | null
}

const ARRAY_START = 'export const CITY_CATALOG: IsoBuilderItem[] = ['
const STRING = String.raw`'(?:[^'\\\n]|\\.)*'`
const GROUP = new RegExp(String.raw`\bgroup: ${STRING}`)
const SUBGROUP = new RegExp(String.raw`\bsubgroup: ${STRING}`)
const PRICE = /, price: \d+(?:\.\d+)?/

const quote = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

function checkName(id: string, field: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || /[\n\r]/.test(value)) {
    throw new Error(`${id}: ${field} inválida`)
  }
  return value.trim()
}

function rewriteLine(line: string, change: CatalogItemChange): string {
  if (!GROUP.test(line) || !SUBGROUP.test(line)) {
    throw new Error(`catalog.ts: a linha de "${change.id}" não tem group e subgroup`)
  }
  const group = checkName(change.id, 'categoria', change.group)
  const subgroup = checkName(change.id, 'subcategoria', change.subgroup)
  const { price } = change
  if (price !== null && (typeof price !== 'number' || !Number.isFinite(price) || price < 0)) {
    throw new Error(`${change.id}: preço inválido`)
  }
  const next = line
    .replace(PRICE, '')
    .replace(GROUP, `group: ${quote(group)}`)
    .replace(SUBGROUP, `subgroup: ${quote(subgroup)}`)
  return price === null ? next : next.replace(SUBGROUP, (field) => `${field}, price: ${price}`)
}

export function applyCatalogChange(text: string, changes: CatalogItemChange[]): string {
  if (!Array.isArray(changes) || changes.length === 0) throw new Error('nenhuma mudança')
  const ids = changes.map((change) => change.id)
  if (new Set(ids).size !== ids.length) throw new Error('a mesma peça veio duas vezes')

  const start = text.indexOf(ARRAY_START)
  const end = start < 0 ? -1 : text.indexOf('\n]', start)
  if (start < 0 || end < 0) throw new Error('catalog.ts: a lista CITY_CATALOG sumiu')
  const lines = text.slice(start, end).split('\n')

  for (const change of changes) {
    const at = lines.flatMap((line, i) => (line.startsWith(`  { id: ${quote(change.id)},`) ? [i] : []))
    if (at.length !== 1) throw new Error(`catalog.ts: ${at.length} linhas com o id "${change.id}"`)
    if (!lines[at[0]].trimEnd().endsWith('},')) {
      throw new Error(`catalog.ts: a peça "${change.id}" não está numa linha só`)
    }
    lines[at[0]] = rewriteLine(lines[at[0]], change)
  }
  return text.slice(0, start) + lines.join('\n') + text.slice(end)
}
