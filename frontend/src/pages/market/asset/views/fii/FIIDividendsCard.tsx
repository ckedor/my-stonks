import type { FIIDividend } from '@/api/market'
import AppBarChart from '@/components/charts/app-bar-chart'
import AppCard from '@/components/ui/AppCard'
import { Box, Stack, Typography } from '@mui/material'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { formatBRL, formatDate, formatMonth } from './format'

const CHART_HEIGHT = 280
const MONTHS_IN_A_YEAR = 12

interface Props {
  dividends: FIIDividend[]
}

/** What the fund has paid per share, month by month.
 *
 *  Bars rather than a line: each one is a payment that happened, not a sample
 *  of something continuous, and the gap left by a month without a distribution
 *  is itself the point.
 *
 *  Grouped by month because that is the fund's own rhythm -- one payment a
 *  month, dated by when it reached the holder. */
export default function FIIDividendsCard({ dividends }: Props) {
  const series = useMemo(
    () => dividends.map((dividend) => ({ date: dividend.date, value: dividend.value_per_share })),
    [dividends],
  )

  const last = dividends.at(-1)

  /** The trailing year of payments, counted from the last one rather than from
   *  today: a fund that stopped paying six months ago should not have its
   *  history silently halved by the calendar. */
  const lastTwelveMonths = useMemo(() => {
    if (!last) return null
    const from = dayjs(last.date).subtract(MONTHS_IN_A_YEAR, 'month')
    return dividends
      .filter((dividend) => dayjs(dividend.date).isAfter(from))
      .reduce((total, dividend) => total + dividend.value_per_share, 0)
  }, [dividends, last])

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
            Último {formatBRL(last.value_per_share)} em {formatDate(last.date)}
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
    </AppCard>
  )
}
