import type { InvestmentFundDividend } from '@/api/market'
import AppBarChart from '@/components/charts/app-bar-chart'
import { AppCard, AppChartArea, AppStack, AppText, SectionTitle } from '@/components/ui'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { formatBRL, formatDate, formatMonth } from '../format'
// A mesma regra que a faixa de decisão usa para achar o último rendimento:
// duas leituras do que é renda e o que é devolução de principal divergiriam no
// dia em que o provedor mudasse o rótulo.
import { isIncome } from './readings'

const CHART_HEIGHT = 280
const MONTHS_IN_A_YEAR = 12

/** O que o fundo pagou por cota, ao longo do tempo.
 *
 *  Barras e não linha: cada uma é um pagamento que aconteceu, não a amostra de
 *  algo contínuo, e o vão deixado por um período sem distribuição é ele próprio
 *  a informação.
 *
 *  Agrupadas por mês, que é a granularidade em que esses pagamentos se
 *  comparam — mas sem afirmar periodicidade: o provedor não estima data de
 *  pagamento por intervalo fixo porque fundos desses tipos não têm um, e dois
 *  pagamentos no mesmo mês são somados em vez de lidos como o dobro do mês
 *  anterior.
 */
export default function FundDividendsCard({
  dividends,
}: {
  dividends: InvestmentFundDividend[]
}) {
  const income = useMemo(() => dividends.filter(isIncome), [dividends])
  const amortizations = useMemo(() => dividends.filter((item) => !isIncome(item)), [dividends])

  const series = useMemo(
    () => income.map((item) => ({ date: item.payment_date, value: item.value_per_share })),
    [income]
  )

  const last = income.at(-1)

  /** O último ano de pagamentos, contado a partir do último e não de hoje: um
   *  fundo que parou de pagar há seis meses não pode ter o histórico cortado
   *  pela metade pelo calendário. */
  const lastTwelveMonths = useMemo(() => {
    if (!last) return null
    const from = dayjs(last.payment_date).subtract(MONTHS_IN_A_YEAR, 'month')
    return income
      .filter((item) => dayjs(item.payment_date).isAfter(from))
      .reduce((total, item) => total + item.value_per_share, 0)
  }, [income, last])

  return (
    <AppCard>
      <AppStack gap="sm">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Rendimentos por cota</SectionTitle>
          {last && (
            <AppText variant="bodySmall" tone="secondary">
              Último {formatBRL(last.value_per_share)} em {formatDate(last.payment_date)}
              {lastTwelveMonths !== null && ` · 12 meses ${formatBRL(lastTwelveMonths)}`}
            </AppText>
          )}
        </AppStack>

        <AppChartArea bleed>
          <AppBarChart
            data={series}
            height={CHART_HEIGHT}
            groupBy="month"
            valueType="number"
            showRangePicker
            defaultRange="5y"
            emptyMessage="O provedor não retornou rendimentos para este fundo."
            valueFormatter={(value) => formatBRL(value)}
            tooltipLabelFormatter={formatMonth}
          />
        </AppChartArea>

        {amortizations.length > 0 && (
          <AppText variant="caption" tone="secondary">
            Fora do gráfico: {amortizations.length}{' '}
            {amortizations.length === 1 ? 'amortização' : 'amortizações'} de capital, somando{' '}
            {formatBRL(amortizations.reduce((total, item) => total + item.value_per_share, 0))} por
            cota. Amortização devolve principal e não é rendimento.
          </AppText>
        )}
      </AppStack>
    </AppCard>
  )
}
