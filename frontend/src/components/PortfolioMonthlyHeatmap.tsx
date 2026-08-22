// src/components/PortfolioMonthlyHeatmap.tsx
import { AppChartArea, AppHeatmapTable, useAppTheme, type AppHeatmapRow } from '@/components/ui'
import dayjs from 'dayjs'
import { useMemo } from 'react'

interface SeriesPoint {
  date: string
  value: number
}

interface Props {
  data: SeriesPoint[]
}

interface HeatmapCell {
  year: number
  monthIndex: number // 0-11
  value: number | null // retorno mensal em %
}

/** Altura reservada quando não há o que desenhar, para a tela não saltar. */
const EMPTY_HEIGHT = 260

const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

export default function PortfolioMonthlyHeatmap({ data }: Props) {
  const theme = useAppTheme()

  // série completa da curva (sem filtro de timeframe)
  const baseSeries: SeriesPoint[] = useMemo(() => {
    return data || []
  }, [data])

  // calcula retorno mensal (em %) por (ano, mês) usando a série inteira
  const { byYear, annualReturns } = useMemo(() => {
    const byYearInner: Record<number, HeatmapCell[]> = {}
    const annual: Record<number, number | null> = {}

    if (!baseSeries.length) {
      return { byYear: byYearInner, annualReturns: annual }
    }

    const sorted = [...baseSeries].sort(
      (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
    )

    // valor do primeiro dia de cada mês
    const monthStart: Record<
      string,
      { date: string; value: number } // key = "YYYY-MM"
    > = {}

    for (const point of sorted) {
      const monthKey = dayjs(point.date).format('YYYY-MM')
      if (
        !monthStart[monthKey] ||
        dayjs(point.date).isBefore(monthStart[monthKey].date)
      ) {
        monthStart[monthKey] = { date: point.date, value: point.value }
      }
    }

    const monthKeys = Object.keys(monthStart).sort()
    const cells: HeatmapCell[] = []

    // retorno do mês = diferença entre início do mês atual e anterior
    for (let i = 1; i < monthKeys.length; i++) {
      const prevKey = monthKeys[i - 1]
      const currKey = monthKeys[i]

      const prev = monthStart[prevKey]
      const curr = monthStart[currKey]

      const prevDate = dayjs(prev.date)
      const year = prevDate.year()
      const monthIndex = prevDate.month()

      const value = (curr.value - prev.value) * 100

      cells.push({ year, monthIndex, value })
    }

    // agrupa por ano
    for (const cell of cells) {
      if (!byYearInner[cell.year]) {
        byYearInner[cell.year] = []
      }
      byYearInner[cell.year].push(cell)
    }

    // retorno anual = composição dos meses do ano
    Object.entries(byYearInner).forEach(([yearStr, cells]) => {
      const year = Number(yearStr)
      let acc = 1
      let hasValue = false

      cells.forEach((c) => {
        if (typeof c.value === 'number') {
          acc *= 1 + c.value / 100
          hasValue = true
        }
      })

      annual[year] = hasValue ? (acc - 1) * 100 : null
    })

    return { byYear: byYearInner, annualReturns: annual }
  }, [baseSeries])

  const years = useMemo(
    () => Object.keys(byYear).map(Number).sort((a, b) => b - a),
    [byYear]
  )

  const getCellStyle = (value: number | null) => {
    if (value == null) {
      return {
        backgroundColor: theme.palette.background.paper,
        color: theme.palette.text.secondary,
      }
    }

    const abs = Math.abs(value)
    let backgroundColor: string
    let color = theme.palette.common.black

    if (value >= 0) {
      if (abs > 8) {
        backgroundColor = theme.palette.success.dark
        color = theme.palette.common.white
      } else if (abs > 4) {
        backgroundColor = theme.palette.success.main
      } else {
        backgroundColor = theme.palette.success.light
      }
    } else {
      if (abs > 8) {
        backgroundColor = theme.palette.error.dark
        color = theme.palette.common.white
      } else if (abs > 4) {
        backgroundColor = theme.palette.error.main
        color = theme.palette.common.white
      } else {
        backgroundColor = theme.palette.error.light
      }
    }

    return { backgroundColor, color }
  }

  if (!years.length) {
    return (
      <AppChartArea
        height={EMPTY_HEIGHT}
        emptyMessage="Sem dados de rentabilidade suficientes para exibir o mapa mensal."
      />
    )
  }

  const percent = (value: number | null) => (value != null ? `${value.toFixed(1)}%` : '')

  const cellFor = (value: number | null) => {
    const { backgroundColor, color } = getCellStyle(value)
    return { text: percent(value), background: backgroundColor, color }
  }

  const rows: AppHeatmapRow[] = years.map((year) => {
    const byMonth = new Map<number, HeatmapCell>()
    ;(byYear[year] || []).forEach((cell) => byMonth.set(cell.monthIndex, cell))

    const annual = annualReturns[year] ?? null

    return {
      label: String(year),
      cells: [
        ...MONTH_LABELS.map((_, monthIndex) => cellFor(byMonth.get(monthIndex)?.value ?? null)),
        cellFor(annual),
      ],
    }
  })

  return (
    <AppHeatmapTable
      rowHeader="Ano"
      columns={[...MONTH_LABELS, 'Ano']}
      rows={rows}
      borderColor={theme.palette.divider}
    />
  )
}
