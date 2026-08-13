import type { FIIDividend } from '@/api/market'
import AppBarChart from '@/components/charts/app-bar-chart'
import AppCard from '@/components/ui/AppCard'
import { Box, Stack, Typography } from '@mui/material'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { formatBRL, formatDate, formatMonth } from './format'

const CHART_HEIGHT = 280
const MONTHS_IN_A_YEAR = 12

/** What the provider labels an ordinary distribution. Funds also amortize
 *  capital, which arrives through the same route under its own label and is a
 *  return of principal, not income — adding the two would overstate what the
 *  fund pays. Payments the provider leaves unlabelled are read as income,
 *  since that is what these routes overwhelmingly carry. */
const INCOME_LABEL = 'RENDIMENTO'

const isIncome = (dividend: FIIDividend) =>
  !dividend.event_type || dividend.event_type.toUpperCase() === INCOME_LABEL

interface Props {
  dividends: FIIDividend[]
}

/** What the fund has paid per share, month by month.
 *
 *  Bars rather than a line: each one is a payment that happened, not a sample
 *  of something continuous, and the gap left by a month without a distribution
 *  is itself the point.
 *
 *  Grouped by month because that is the fund's own rhythm — one payment a
 *  month, dated by when it reached the holder. */
export default function FIIDividendsCard({ dividends }: Props) {
  const income = useMemo(() => dividends.filter(isIncome), [dividends])
  const amortizations = useMemo(() => dividends.filter((item) => !isIncome(item)), [dividends])

  const series = useMemo(
    () => income.map((item) => ({ date: item.payment_date, value: item.value_per_share })),
    [income],
  )

  const last = income.at(-1)

  /** The trailing year of payments, counted from the last one rather than from
   *  today: a fund that stopped paying six months ago should not have its
   *  history silently halved by the calendar. */
  const lastTwelveMonths = useMemo(() => {
    if (!last) return null
    const from = dayjs(last.payment_date).subtract(MONTHS_IN_A_YEAR, 'month')
    return income
      .filter((item) => dayjs(item.payment_date).isAfter(from))
      .reduce((total, item) => total + item.value_per_share, 0)
  }, [income, last])

  return (
    <AppCard>
      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        flexWrap="wrap"
        rowGap={0.5}
        columnGap={2}
        sx={{ mb: 1.5 }}
      >
        <Typography variant="h6">Rendimentos por cota</Typography>
        {last && (
          <Typography variant="body2" color="text.secondary">
            Último {formatBRL(last.value_per_share)} em {formatDate(last.payment_date)}
            {lastTwelveMonths !== null && ` · 12 meses ${formatBRL(lastTwelveMonths)}`}
          </Typography>
        )}
      </Stack>

      <Box sx={{ mx: -1.8 }}>
        <AppBarChart
          data={series}
          height={CHART_HEIGHT}
          groupBy="month"
          valueType="number"
          showRangePicker
          defaultRange="5y"
          emptyMessage="O provedor não informa rendimentos para este fundo."
          valueFormatter={(value) => formatBRL(value)}
          tooltipLabelFormatter={formatMonth}
        />
      </Box>

      {amortizations.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Fora do gráfico: {amortizations.length}{' '}
          {amortizations.length === 1 ? 'amortização' : 'amortizações'} de capital, somando{' '}
          {formatBRL(
            amortizations.reduce((total, item) => total + item.value_per_share, 0),
          )}{' '}
          por cota. Amortização devolve principal e não é rendimento.
        </Typography>
      )}
    </AppCard>
  )
}
