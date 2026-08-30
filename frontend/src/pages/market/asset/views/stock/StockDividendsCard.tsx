import type { StockCashDividend, StockShareDividend, StockSubscription } from '@/api/market'
import AppBarChart from '@/components/charts/app-bar-chart'
import {
  AppCard,
  AppChartArea,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { formatBRLPerShare, formatDate, formatMonth, formatMultiple } from '../format'
// A mesma regra que a faixa de decisão usa para separar JCP de dividendo: duas
// leituras do que tem retenção na fonte divergiriam no dia em que o provedor
// mudasse o rótulo.
import { isInterestOnEquity } from './readings'

const CHART_HEIGHT = 280
const MONTHS_IN_A_YEAR = 12

const SHARE_COLUMNS: AppSimpleTableColumn<StockShareDividend>[] = [
  { label: 'Evento', render: (event) => event.label ?? '—' },
  {
    label: 'Proporção',
    render: (event) => event.complete_factor ?? formatMultiple(event.factor),
  },
  {
    label: 'Último dia com direito',
    align: 'right',
    sortValue: (event) => event.last_date_prior,
    render: (event) => formatDate(event.last_date_prior),
  },
  {
    label: 'Aprovado em',
    align: 'right',
    sortValue: (event) => event.approved_on,
    render: (event) => formatDate(event.approved_on),
  },
]

const SUBSCRIPTION_COLUMNS: AppSimpleTableColumn<StockSubscription>[] = [
  { label: 'Evento', render: (event) => event.label ?? '—' },
  {
    label: 'Proporção',
    render: (event) => event.complete_factor ?? formatMultiple(event.factor),
  },
  {
    label: 'Preço',
    align: 'right',
    sortValue: (event) => event.price,
    render: (event) => formatBRLPerShare(event.price),
  },
  {
    label: 'Último dia com direito',
    align: 'right',
    sortValue: (event) => event.last_date_prior,
    render: (event) => formatDate(event.last_date_prior),
  },
]

/** O que a companhia pagou, e como pagou.
 *
 *  Três listas e não uma. Um pagamento em dinheiro tem valor e data; uma
 *  bonificação tem proporção e nenhum dos dois. Somados numa tabela só, quem
 *  lê renda recebida somaria um desdobramento dentro dela — e um desdobramento
 *  não põe um centavo no bolso de ninguém.
 *
 *  No gráfico só o dinheiro, em barras: cada uma é um pagamento que aconteceu,
 *  e o vão de um período sem provento é ele próprio a informação. Agrupadas por
 *  mês, que é onde esses pagamentos se comparam; dois no mesmo mês são somados
 *  em vez de lidos como o dobro do mês anterior.
 *
 *  JCP aparece separado do dividendo no rodapé porque tem retenção de 15% na
 *  fonte. Os dois no mesmo total diriam que a companhia entregou mais do que
 *  entregou.
 */
export default function StockDividendsCard({
  cashDividends,
  shareDividends,
  subscriptions,
}: {
  cashDividends: StockCashDividend[]
  shareDividends: StockShareDividend[]
  subscriptions: StockSubscription[]
}) {
  const paid = useMemo(
    () =>
      cashDividends.filter(
        (payment) => payment.payment_date != null && payment.value_per_share != null
      ),
    [cashDividends]
  )

  const series = useMemo(
    () =>
      paid.map((payment) => ({
        date: payment.payment_date as string,
        value: payment.value_per_share as number,
      })),
    [paid]
  )

  const last = paid.at(-1)

  /** O último ano de pagamentos, contado a partir do último e não de hoje: uma
   *  companhia que parou de pagar há seis meses não pode ter o histórico
   *  cortado pela metade pelo calendário. */
  const lastTwelveMonths = useMemo(() => {
    if (!last) return null
    const from = dayjs(last.payment_date).subtract(MONTHS_IN_A_YEAR, 'month')
    const window = paid.filter((payment) => dayjs(payment.payment_date).isAfter(from))
    const total = window.reduce((sum, payment) => sum + (payment.value_per_share ?? 0), 0)
    const interest = window
      .filter(isInterestOnEquity)
      .reduce((sum, payment) => sum + (payment.value_per_share ?? 0), 0)
    return { total, interest }
  }, [paid, last])

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Proventos por ação</SectionTitle>
          {last && (
            <AppText variant="bodySmall" tone="secondary">
              Último {formatBRLPerShare(last.value_per_share)} em{' '}
              {formatDate(last.payment_date)}
              {lastTwelveMonths &&
                ` · 12 meses ${formatBRLPerShare(lastTwelveMonths.total)}`}
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
            emptyMessage="O provedor não retornou proventos para esta companhia."
            valueFormatter={(value) => formatBRLPerShare(value)}
            tooltipLabelFormatter={formatMonth}
          />
        </AppChartArea>

        {lastTwelveMonths && lastTwelveMonths.interest > 0 && (
          <AppText variant="caption" tone="secondary">
            Dos {formatBRLPerShare(lastTwelveMonths.total)} dos últimos 12 meses,{' '}
            {formatBRLPerShare(lastTwelveMonths.interest)} são juros sobre capital
            próprio, que têm 15% de imposto retido na fonte. Dividendo não tem.
          </AppText>
        )}

        {shareDividends.length > 0 && (
          <AppStack gap="xs">
            <SectionLabel>Pagamentos em ações</SectionLabel>
            {/* Fora do gráfico de propósito: uma bonificação não tem valor por
                ação, e desenhá-la ao lado de um dividendo daria a ela uma
                altura que ela não tem. */}
            <AppSimpleTable
              rows={shareDividends}
              columns={SHARE_COLUMNS}
              getRowKey={(event) => `${event.label ?? 'evento'}-${event.approved_on ?? event.last_date_prior ?? ''}`}
              emptyMessage="Nenhum."
            />
          </AppStack>
        )}

        {subscriptions.length > 0 && (
          <AppStack gap="xs">
            <SectionLabel>Subscrições</SectionLabel>
            <AppSimpleTable
              rows={subscriptions}
              columns={SUBSCRIPTION_COLUMNS}
              getRowKey={(event) => `${event.label ?? 'evento'}-${event.approved_on ?? event.last_date_prior ?? ''}`}
              emptyMessage="Nenhuma."
            />
          </AppStack>
        )}
      </AppStack>
    </AppCard>
  )
}
