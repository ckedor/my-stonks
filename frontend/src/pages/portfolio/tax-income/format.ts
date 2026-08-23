/* Formatação compartilhada pelas quatro abas da declaração. */

/** Zero não é informação numa apuração: a linha existe, mas não houve venda,
 *  lucro ou imposto naquele mês. O travessão diz isso melhor que R$ 0,00. */
export const formatTaxValue = (value: number) =>
  value === 0
    ? '-'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** O sinal de um ganho lido como as outras telas leem retorno. */
export const gainTone = (value: number): 'success' | 'danger' | 'default' =>
  value > 0 ? 'success' : value < 0 ? 'danger' : 'default'

/** A alíquota efetiva do mês: o imposto sobre a base que o gerou. */
export const taxRate = (tax: number, base: number) =>
  tax > 0 ? `${((tax / base) * 100).toFixed(0)}%` : '-'
