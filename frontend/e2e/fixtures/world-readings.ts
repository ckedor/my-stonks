/* Resposta de `GET /market_data/readings/world` para a aba Mundo.

   Sintética e determinística: curvas de seno sobre uma tendência, em datas
   fixas. Nenhuma conta aqui depende do relógio de quem roda o teste — um
   `new Date()` mudaria o snapshot todo dia. */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const LAST = Date.UTC(2026, 8, 25)

function history(weeks: number, base: number, growth: number, wave: number) {
  const values = Array.from(
    { length: weeks },
    (_, i) => base * (1 + growth) ** (i / 52) * (1 + wave * Math.sin(i / 9)),
  )
  return values.map((value, i) => {
    const window = values.slice(Math.max(0, i - 39), i + 1)
    return {
      date: new Date(LAST - (weeks - 1 - i) * WEEK_MS).toISOString().slice(0, 10),
      value: Number(value.toPrecision(6)),
      moving_average:
        window.length === 40
          ? Number((window.reduce((a, b) => a + b, 0) / 40).toPrecision(6))
          : null,
    }
  })
}

export function level(key: string, seriesId: number | null, base: number, growth: number, wave: number) {
  const points = history(26 * 52, base, growth, wave)
  const last = points[points.length - 1]
  return {
    key,
    series_id: seriesId,
    as_of: last.date,
    since: points[0].date,
    value: last.value,
    since_start_annualized_return: growth * 0.85,
    year_to_date_return: growth * 0.7,
    one_year_return: growth,
    five_year_annualized_return: growth * 0.8,
    ten_year_annualized_return: growth * 0.9,
    ten_year_return_percentile: 0.62,
    moving_average: last.value * 0.96,
    distance_to_moving_average: 0.045,
    distance_percentile: 0.71,
    drawdown: -0.03,
    history: points,
  }
}

function rate(key: string, base: number, wave: number, percentile: number) {
  const points = history(10 * 52, base, 0, wave)
  const last = points[points.length - 1]
  return {
    key,
    as_of: last.date,
    since: points[0].date,
    value: last.value,
    one_year_ago: points[points.length - 53].value,
    percentile,
    history: points,
  }
}

export const WORLD_READINGS = {
  levels: [
    level('usd_brl', null, 2.2, 0.035, 0.08),
    level('btc', null, 400, 0.45, 0.3),
    level('msci_acwi', 9, 100, 0.07, 0.06),
    level('msci_world', 8, 2500, 0.075, 0.06),
    level('msci_usa', 11, 2700, 0.09, 0.07),
    level('msci_acwi_ex_usa', 12, 110, 0.05, 0.08),
    level('msci_em', 10, 100, 0.09, 0.12),
    level('ibovespa_usd', 6, 4000, 0.06, 0.15),
  ],
  comparisons: [
    level('usa_vs_acwi_ex_usa', null, 100, 0.022, 0.05),
    level('em_vs_world', null, 100, 0.015, 0.2),
  ],
  rates: [rate('cdi', 0.11, 0.25, 0.76), rate('real_interest', 0.05, 0.6, 0.96)],
}
