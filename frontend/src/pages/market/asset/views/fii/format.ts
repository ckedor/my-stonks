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

/** P/VP, which is a multiple and not a percentage: 1.018 reads as 1,02x, or a
 *  share trading slightly above what the fund says it is worth. */
export const formatMultiple = (value: number | null | undefined) =>
  nullish(value) ? EMPTY : `${RATIO.format(value!)}x`

export const formatDate = (value: string | null | undefined) =>
  value ? dayjs(value).format('DD/MM/YYYY') : EMPTY

export const formatMonth = (value: string) => dayjs(value).format('MM/YYYY')
