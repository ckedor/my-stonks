import { ReturnsEntry } from '@/types'
import dayjs from 'dayjs'

/** Rebaseia uma série de retornos acumulados para o início de uma janela, e a
 *  preenche para frente sobre as datas pedidas.
 *
 *  Duas coisas acontecem aqui, e as duas importam para curvas comparáveis:
 *
 *  - **Rebase.** O retorno acumulado vem medido desde o início da série. Para
 *    comparar duas curvas na mesma janela, todas precisam valer zero no
 *    primeiro dia dela. Isso é `(1 + valor) / (1 + base) - 1`, e não uma
 *    subtração: retorno acumulado compõe.
 *  - **Preenchimento.** Nem toda série tem ponto em toda data — feriado de um
 *    mercado é pregão de outro. Um dia sem ponto repete o último conhecido, em
 *    vez de abrir um buraco na linha.
 *
 *  A base é o último valor conhecido *em ou antes* do início da janela, o que
 *  mantém a curva correta mesmo quando a série começa antes dela. */
/** A data mais antiga de uma série, sem supor que ela venha ordenada. */
function firstDate(series: ReturnsEntry[]): string | null {
  let oldest: string | null = null
  for (const point of series) {
    if (oldest === null || point.date < oldest) oldest = point.date
  }
  return oldest
}

export interface RebasedWindow {
  /** Datas desenhadas, em ordem. */
  dates: string[]
  /** Cada série rebaseada ao primeiro dia da janela, nas mesmas datas. */
  byKey: Record<string, ReturnsEntry[]>
  start: string | null
}

/** Alinha várias séries de retorno em uma janela comum, todas partindo de zero.
 *
 *  A janela começa no **último dos começos**: o CDI tem anos de série a mais que
 *  uma posição aberta há alguns meses, e sem esse corte a curva mais nova seria
 *  preenchida com zero num trecho em que ela ainda não existia — uma reta rente
 *  ao eixo que parece desempenho nulo, e não ausência de dado. Se um benchmark
 *  começar depois, o corte é nele, pelo mesmo motivo. */
export function rebaseWindow(
  seriesByKey: Record<string, ReturnsEntry[]>,
  fromISO: string | null,
): RebasedWindow {
  const keys = Object.keys(seriesByKey)

  const dateSet = new Set<string>()
  const firstDates: string[] = []
  for (const key of keys) {
    for (const point of seriesByKey[key]) dateSet.add(point.date)
    const first = firstDate(seriesByKey[key])
    if (first) firstDates.push(first)
  }

  const commonStart = firstDates.length ? firstDates.sort().at(-1)! : null
  const start = [fromISO, commonStart].filter((d): d is string => d != null).sort().at(-1) ?? null

  const dates = [...dateSet].sort().filter((date) => !start || date >= start)

  const byKey: Record<string, ReturnsEntry[]> = {}
  for (const key of keys) byKey[key] = normalizeReturns(seriesByKey[key], dates)

  return { dates, byKey, start: dates[0] ?? null }
}

export function normalizeReturns(series: ReturnsEntry[], dates: string[]): ReturnsEntry[] {
  if (!dates.length) return []

  const sorted = [...series].sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix())
  const valuesMap = new Map(sorted.map((p) => [p.date, p.value]))

  const startDate = dates[0]

  let baseValue = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (!dayjs(sorted[i].date).isAfter(startDate)) {
      baseValue = sorted[i].value
      break
    }
  }

  let lastKnown = baseValue

  return dates.map((date) => {
    if (valuesMap.has(date)) lastKnown = valuesMap.get(date) as number

    // O denominador protege contra uma base <= -1, que faria a divisão explodir
    // ou trocar de sinal.
    const denom = 1 + baseValue
    const numer = 1 + lastKnown
    const rebased = denom > 0 ? numer / denom - 1 : 0

    return { date, value: rebased }
  })
}
