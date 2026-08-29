import { EMPTY_LIST } from '@/queries/empty'
import { usePatrimony } from '@/queries/portfolio'
import AppBarChart, { TimeSeriesPoint } from '@/components/charts/app-bar-chart/AppBarChart'
import { GroupBy } from '@/components/charts/app-bar-chart/helpers'
import { useCurrency } from '@/hooks/useCurrency'
import { DateRangeKey } from '@/lib/utils/date'
import dayjs from 'dayjs'
import { useMemo } from 'react'

type PatrimonyEvolutionRow = {
  date: string
  [key: string]: unknown
}

interface Props {
  height?: number | string
  groupBy?: GroupBy
  defaultRange?: DateRangeKey
  title?: string | null
  fitContainer?: boolean
}

function toTimeSeries(
  rows: PatrimonyEvolutionRow[],
  sourceKey: string
): TimeSeriesPoint[] {
  return (rows ?? [])
    .filter((r) => r?.date)
    .map((r) => ({
      date: dayjs(r.date).format('YYYY-MM-DD'),
      value: Number((r as any)[sourceKey] ?? 0),
    }))
}

export default function PortfolioMonthlyAportsChart({
  height = 400,
  groupBy = 'month',
  defaultRange = '1y',
  title = 'Aportes Mensais',
  fitContainer = false,
}: Props) {
  const rows = usePatrimony().data ?? EMPTY_LIST as PatrimonyEvolutionRow[]
  const loading = usePatrimony().isPending
  const { currency, locale } = useCurrency()

  const sourceKey = 'aported'

  const data = useMemo(() => toTimeSeries(rows, sourceKey), [rows])

  return (
    <AppBarChart
      data={data}
      loading={loading}
      height={height}
      title={title ?? undefined}
      emptyMessage="Sem dados de aportes para exibir."
      colorMode="profit-loss"
      valueType="currency"
      currency={currency}
      locale={locale}
      groupBy={groupBy}
      showRangePicker
      defaultRange={defaultRange}
      labelSide="right"
      showGroupBySelector
      fitContainer={fitContainer}
    />
  )
}
