import dayjs from 'dayjs'

/** A fund's own numbers are published in reais, and the backend serves them as
 *  published -- no exchange rate is applied to them. So they are formatted in
 *  BRL here whatever currency the reader chose for the price chart, and the
 *  cards say so, rather than printing a real under a dollar sign. */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 2,
})

/** O que o fundo pagou por cota, e nunca um valor absoluto.
 *
 *  Três casas no máximo porque é onde a informação está: entre R$ 0,089 e
 *  R$ 0,098 há quase 10% de diferença, e duas casas apagam a distinção
 *  arredondando as duas para R$ 0,09. Duas no mínimo para que um fundo que
 *  paga R$ 12,50 não seja escrito "R$ 12,5". */
const BRL_PER_SHARE = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
})

const COUNT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const COUNT_COMPACT = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})
const RATIO = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** What an absent indicator reads as. A fund the provider does not cover keeps
 *  its tile, so the reader can tell "not published" from "zero". */
export const EMPTY = '—'

const nullish = (value: number | null | undefined) => value === null || value === undefined

export const formatBRL = (value: number | null | undefined) =>
  nullish(value) ? EMPTY : BRL.format(value!)

/** For balance-sheet sums, where nine digits of precision say nothing. */
export const formatCompactBRL = (value: number | null | undefined) =>
  nullish(value) ? EMPTY : BRL_COMPACT.format(value!)

/** Um pagamento por cota.
 *
 *  Existe separado de `formatBRL` porque as duas grandezas aparecem lado a
 *  lado: o rendimento do mês em reais por cota e o yield em percentual. Escritos
 *  do mesmo jeito, 0,089 e 0,1238 leem como a mesma coisa — e não são. */
export const formatBRLPerShare = (value: number | null | undefined) =>
  nullish(value) ? EMPTY : BRL_PER_SHARE.format(value!)

export const formatCount = (value: number | null | undefined) =>
  nullish(value) ? EMPTY : COUNT.format(value!)

export const formatCompactCount = (value: number | null | undefined) =>
  nullish(value) ? EMPTY : COUNT_COMPACT.format(value!)

export const formatRatio = (value: number | null | undefined) =>
  nullish(value) ? EMPTY : RATIO.format(value!)

/** Yields and returns arrive as ratios: 0.12381 is 12.381%. Scaling them is
 *  presentation's job precisely so that the number stays comparable upstream. */
export const formatPercent = (value: number | null | undefined) =>
  nullish(value) ? EMPTY : `${RATIO.format(value! * 100)}%`

/** A diferença entre duas razões, que é uma diferença em pontos percentuais e
 *  não uma variação percentual: de 2,91% para 3,28% de vacância são 0,37 p.p.,
 *  e escrever "12,7%" ali — que é a variação relativa — diria outra coisa.
 *
 *  O sinal é sempre escrito, inclusive o positivo: um delta sem sinal obriga o
 *  leitor a lembrar contra o quê está comparando. */
export const formatPercentagePoints = (value: number | null | undefined) => {
  if (nullish(value)) return EMPTY
  const points = value! * 100
  const sign = points > 0 ? '+' : points < 0 ? '−' : ''
  return `${sign}${RATIO.format(Math.abs(points))} p.p.`
}

/** P/VP, which is a multiple and not a percentage: 1.018 reads as 1,02x, or a
 *  share trading slightly above what the fund says it is worth. */
export const formatMultiple = (value: number | null | undefined) =>
  nullish(value) ? EMPTY : `${RATIO.format(value!)}x`

/** Areas are square metres and are published to the centimetre. Nobody reads a
 *  warehouse to two decimals, so the fraction goes. */
export const formatArea = (value: number | null | undefined) =>
  nullish(value) ? EMPTY : `${COUNT.format(Math.round(value!))} m²`

/** The fund's own registration, written the way a document is.
 *  Anything that is not the fourteen digits is shown as it came. */
export const formatCNPJ = (value: string | null | undefined) => {
  if (!value) return EMPTY
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 14) return value
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export const formatDate = (value: string | null | undefined) =>
  value ? dayjs(value).format('DD/MM/YYYY') : EMPTY

export const formatMonth = (value: string) => dayjs(value).format('MM/YYYY')
