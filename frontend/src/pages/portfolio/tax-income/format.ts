/* Formatação compartilhada pelas abas da declaração. */

import type { DarfStatus, Money, TaxRegime } from '@/api/incomeTax'
import dayjs from 'dayjs'

/** O valor exato que o backend manda, como número para escrever. */
export const money = (value: Money): number => Number(value)

/** Zero não é informação numa apuração: a linha existe, mas não houve venda,
 *  lucro ou imposto naquele mês. O travessão diz isso melhor que R$ 0,00. */
export const formatTaxValue = (value: number | Money) => {
  const amount = typeof value === 'string' ? money(value) : value
  return amount === 0 ? '-' : amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** O mesmo valor sem o símbolo, para a tabela mensal: são dez colunas de
 *  reais, e o "R$" repetido em cada célula é o que as empurrava para fora do
 *  card. O título do quadro diz a moeda uma vez. */
export const formatTaxAmount = (value: Money) => {
  const amount = money(value)
  return amount === 0
    ? '-'
    : amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** O sinal de um ganho lido como as outras telas leem retorno. */
export const gainTone = (value: number | Money): 'success' | 'danger' | 'default' => {
  const amount = typeof value === 'string' ? money(value) : value
  return amount > 0 ? 'success' : amount < 0 ? 'danger' : 'default'
}

export const formatMonth = (day: string) => dayjs(day).format('MMM/YYYY')

export const formatDay = (day: string) => dayjs(day).format('DD/MM/YYYY')

/** A alíquota da regra, como a lei a escreve: "15%", "17,5%". */
export const formatRate = (rate: string | null) =>
  rate === null
    ? 'progressiva'
    : `${(Number(rate) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

export const REGIME_LABEL: Record<TaxRegime, string> = {
  common: 'Operações comuns',
  real_estate_fund: 'FII e Fiagro',
  crypto: 'Criptoativos',
}

export const DARF_STATUS: Record<
  DarfStatus,
  { label: string; tone: 'neutral' | 'success' | 'info' | 'caution' | 'danger' }
> = {
  below_minimum: { label: 'Abaixo do mínimo', tone: 'neutral' },
  paid: { label: 'Pago', tone: 'success' },
  partially_paid: { label: 'Pago em parte', tone: 'caution' },
  open: { label: 'A pagar', tone: 'info' },
  overdue: { label: 'Vencido', tone: 'danger' },
}
