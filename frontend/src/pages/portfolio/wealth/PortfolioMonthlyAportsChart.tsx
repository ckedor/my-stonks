import AppBarChart, { TimeSeriesPoint } from '@/components/charts/app-bar-chart/AppBarChart'
import { GroupBy } from '@/components/charts/app-bar-chart/helpers'
import { useCurrency } from '@/hooks/useCurrency'
import { DateRangeKey } from '@/lib/utils/date'
import { usePatrimonyStore } from '@/stores/portfolio/patrimony'
import dayjs from 'dayjs'
import { useMemo } from 'react'

type PatrimonyEvolutionRow = {
  date: string
  [key: string]: unknown
}

interface Props {
  height?: number
  groupBy?: GroupBy
  defaultRange?: DateRangeKey
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
  defaultRange = 'max',
}: Props) {
  const rows = usePatrimonyStore(s => s.patrimony) as PatrimonyEvolutionRow[]
  const loading = usePatrimonyStore(s => s.loading)
  const { currency, locale } = useCurrency()

  const sourceKey = 'aported'

  const data = useMemo(() => toTimeSeries(rows, sourceKey), [rows])

  return (
    <AppBarChart
      data={data}
      loading={loading}
      height={height}
      title="Aportes Mensais"
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
    />
  )
}
