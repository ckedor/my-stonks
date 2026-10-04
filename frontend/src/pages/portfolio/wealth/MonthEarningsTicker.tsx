import { AppMetric } from '@/components/ui'
import { useEffect, useState } from 'react'
import { monthEarningsAt, monthlyEarnings } from './month-earnings'

/* O contador do mês: o patrimônio de hoje rendendo no CAGR histórico desde
 * o dia 1º, subindo a cada quadro. É brincadeira — a conta está em
 * `month-earnings.ts` —, e a dica do rótulo diz isso a quem perguntar.
 *
 * O instante é lido do relógio a cada quadro, não somado: com a aba em
 * segundo plano o `requestAnimationFrame` para, e na volta o número já está
 * onde deveria. Pelo mesmo motivo a virada do mês zera sozinha. */

/** Casas além dos centavos: com elas o fim do número gira a olho nu. */
const EARNED_FRACTION_DIGITS = 5

export interface MonthEarningsTickerProps {
  patrimony: number
  /** Fração anual (0.12 para 12%). */
  cagr: number
  formatCurrency: (value: number, fractionDigits?: number) => string
}

export default function MonthEarningsTicker({ patrimony, cagr, formatCurrency }: MonthEarningsTickerProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let frame = requestAnimationFrame(function tick() {
      setNow(new Date())
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const earned = monthEarningsAt(patrimony, cagr, now)
  const month = now.toLocaleString('pt-BR', { month: 'long' })
  const sign = earned >= 0 ? '+' : ''
  const monthly = monthlyEarnings(patrimony, cagr)

  return (
    <>
      <AppMetric
        label={`Rendido em ${month}`}
        hint="De brincadeira: o patrimônio de hoje rendendo no CAGR histórico desde o dia 1º. Não é o resultado real do mês."
        value={`${sign}${formatCurrency(earned, EARNED_FRACTION_DIGITS)}`}
        tone={earned >= 0 ? 'success' : 'danger'}
      />
      <AppMetric
        label="Rende por mês"
        hint="O patrimônio de hoje rendendo no CAGR histórico, em doze meses compostos. Uma projeção, não uma promessa."
        value={`${monthly >= 0 ? '+' : ''}${formatCurrency(monthly)}`}
        tone={monthly >= 0 ? 'success' : 'danger'}
      />
    </>
  )
}
