/** Preço na moeda do papel. Abaixo de um, com as casas que uma cripto de
 *  centavos precisa para não virar "R$ 0,00". */
export const money = (value: number | null | undefined, currency: string) =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', {
        style: 'currency',
        currency,
        minimumFractionDigits: value < 1 ? 4 : 2,
        maximumFractionDigits: value < 1 ? 6 : 2,
      })

/** Dinheiro grande em poucas letras: "R$ 1,2 bi". */
export const compactMoney = (value: number | null | undefined, currency = 'BRL') =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      })

/** Uma fração como porcentagem: 0,0898 vira "8,98%". */
export const fractionPercent = (value: number | null | undefined) =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

export const ratio = (value: number | null | undefined) =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Uma fração com sinal: 0,172 vira "+17,2%". */
export const signedFraction = (value: number | null | undefined) =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        signDisplay: 'exceptZero',
      })

export const fractionTone = (value: number | null | undefined) =>
  value == null || value === 0
    ? ('secondary' as const)
    : value > 0
      ? ('success' as const)
      : ('danger' as const)
