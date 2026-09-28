import type { LevelReading, ReadingPoint } from '@/api/market'

/** Como cada leitura se apresenta. As chaves são as do backend; o texto é da
 *  tela, e fica aqui para que o servidor não precise saber falar português. */
const READING_COPY: Record<string, { title: string; label: string }> = {
  usd_brl: { title: 'Dólar', label: 'Câmbio · USD/BRL' },
  btc: { title: 'Bitcoin', label: 'Cripto · BTC em USD' },
  gold: { title: 'Ouro', label: 'Commodity · US$ por onça troy' },
  cdi: { title: 'CDI', label: 'Brasil · juro básico, ao ano' },
  real_interest: { title: 'Juro real', label: 'CDI dos últimos 12 meses descontado o IPCA' },
  msci_acwi: { title: 'Mundo', label: 'MSCI ACWI · desenvolvidos e emergentes' },
  msci_world: { title: 'Desenvolvidos', label: 'MSCI World · 23 mercados desenvolvidos' },
  msci_usa: { title: 'EUA', label: 'MSCI USA' },
  msci_acwi_ex_usa: { title: 'Mundo ex-EUA', label: 'MSCI ACWI ex-USA' },
  msci_em: { title: 'Emergentes', label: 'MSCI Emerging Markets' },
  ibovespa_usd: { title: 'Brasil', label: 'Ibovespa em dólar, pontos convertidos pelo câmbio' },
  usa_vs_acwi_ex_usa: { title: 'EUA × mundo ex-EUA', label: 'MSCI USA ÷ MSCI ACWI ex-USA' },
  em_vs_world: { title: 'Emergentes × desenvolvidos', label: 'MSCI EM ÷ MSCI World' },
}

export const copyOf = (key: string) => READING_COPY[key] ?? { title: key, label: '' }

const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})
const RATE = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Variação com sinal: `+12,3%`. Traço quando não há o que medir. */
export const signedPercent = (value: number | null | undefined) =>
  value == null ? '—' : PERCENT.format(value)

/** Taxa ao ano, sem sinal: `13,65% a.a.`. */
export const ratePerYear = (value: number | null | undefined) =>
  value == null ? '—' : `${RATE.format(value)} a.a.`

export const changeTone = (value: number | null | undefined) =>
  value == null || value === 0
    ? ('secondary' as const)
    : value > 0
      ? ('success' as const)
      : ('danger' as const)

/** O valor de uma leitura de nível, na unidade dela. Índice é ponto; a
 *  comparação é base 100 no primeiro dia comum. */
export function formatLevel(reading: Pick<LevelReading, 'key' | 'value'>, value = reading.value) {
  if (reading.key === 'usd_brl') {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }
  if (reading.key === 'btc' || reading.key === 'gold') {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
  }
  return value.toLocaleString('pt-BR', { maximumFractionDigits: value >= 1000 ? 0 : 2 })
}

/** Percentil como se lê: "62º percentil". */
export const percentileLabel = (percentile: number | null) =>
  percentile == null ? 'sem histórico suficiente' : `${Math.round(percentile * 100)}º percentil`

export type PercentileZone = 'very-low' | 'low' | 'middle' | 'high' | 'very-high'

/** Em que faixa da própria história o número está. Os cortes são decis e
 *  quintis, e nada além disso: não dizem se está caro, dizem onde está. */
export function percentileZone(percentile: number | null): PercentileZone | null {
  if (percentile == null) return null
  if (percentile >= 0.9) return 'very-high'
  if (percentile >= 0.7) return 'high'
  if (percentile <= 0.1) return 'very-low'
  if (percentile <= 0.3) return 'low'
  return 'middle'
}

export const PERCENTILE_ZONE_LABEL: Record<PercentileZone, string> = {
  'very-high': 'Extremo alto',
  high: 'Alto',
  middle: 'Na faixa central',
  low: 'Baixo',
  'very-low': 'Extremo baixo',
}

export type ChartWindow = '1y' | '5y' | '10y' | 'max'

export const CHART_WINDOWS: { value: ChartWindow; label: string }[] = [
  { value: '1y', label: '1 ano' },
  { value: '5y', label: '5 anos' },
  { value: '10y', label: '10 anos' },
  { value: 'max', label: 'Tudo' },
]

const WINDOW_YEARS: Record<Exclude<ChartWindow, 'max'>, number> = { '1y': 1, '5y': 5, '10y': 10 }

/** Os pontos dentro da janela, contada para trás a partir do último, mais o
 *  último fechamento antes dela: é contra ele que o servidor mede os 12 meses,
 *  e começar no primeiro ponto de dentro faria o "em 1 ano" do gráfico medir
 *  uma semana a menos que o "12 meses" ao lado. */
export function pointsInWindow(points: ReadingPoint[], window: ChartWindow): ReadingPoint[] {
  if (window === 'max' || points.length === 0) return points
  const start = new Date(`${points[points.length - 1].date}T00:00:00Z`)
  start.setUTCFullYear(start.getUTCFullYear() - WINDOW_YEARS[window])
  const from = start.toISOString().slice(0, 10)
  let base = -1
  while (base + 1 < points.length && points[base + 1].date <= from) base += 1
  return base === -1 ? points : points.slice(base)
}

/** Variação entre o primeiro e o último ponto da janela. */
export function windowChange(points: ReadingPoint[]): number | null {
  if (points.length < 2 || points[0].value === 0) return null
  return points[points.length - 1].value / points[0].value - 1
}

/** Para onde o card de uma leitura leva: a série, o ativo ou a tela do câmbio.
 *  Uma razão entre índices e o juro real são contas desta aba e não têm tela. */
export function readingHref(reading: {
  key: string
  series_id?: number | null
  asset_id?: number | null
}): string | null {
  if (reading.series_id != null) return `/market/series/${reading.series_id}`
  if (reading.asset_id != null) return `/market/asset/${reading.asset_id}`
  if (reading.key === 'usd_brl') return '/market/usd-brl'
  return null
}

export type ThermometerMetric = 'trend' | 'decade' | 'drawdown'

export interface ThermometerRow {
  key: string
  name: string
  /** Onde o ponto cai: percentil de 0 a 100, ou a queda em pontos percentuais. */
  position: number
  /** O número em si, como a linha o escreve. */
  value: string
  percentile: number | null
}

const METRIC_OF: Record<
  ThermometerMetric,
  (reading: LevelReading) => { value: number | null; percentile: number | null }
> = {
  trend: (reading) => ({
    value: reading.distance_to_moving_average,
    percentile: reading.distance_percentile,
  }),
  decade: (reading) => ({
    value: reading.ten_year_annualized_return,
    percentile: reading.ten_year_return_percentile,
  }),
  drawdown: (reading) => ({ value: reading.drawdown, percentile: null }),
}

/** As linhas do termômetro para uma pergunta, da mais alta na própria
 *  história para a mais baixa — ou, na queda, da mais funda para o topo.
 *  Quem não tem histórico para a pergunta sai das linhas e vai para `missing`. */
export function thermometerRows(
  readings: LevelReading[],
  metric: ThermometerMetric
): { rows: ThermometerRow[]; missing: string[] } {
  const rows: ThermometerRow[] = []
  const missing: string[] = []
  for (const reading of readings) {
    const { value, percentile } = METRIC_OF[metric](reading)
    const name = copyOf(reading.key).title
    const position = metric === 'drawdown' ? value : percentile
    if (value == null || position == null) {
      missing.push(name)
      continue
    }
    rows.push({
      key: reading.key,
      name,
      position: position * 100,
      value: metric === 'decade' ? `${signedPercent(value)} a.a.` : signedPercent(value),
      percentile,
    })
  }
  rows.sort((a, b) => (metric === 'drawdown' ? a.position - b.position : b.position - a.position))
  return { rows, missing }
}

/** Até onde a régua do termômetro vai. O percentil cabe de 0 a 100, mas
 *  desenhar tudo deixava metade da régua vazia quando os mercados estão
 *  juntos: ela vai do ponto mais baixo ao mais alto — sempre passando pelo
 *  meio, de onde as hastes saem —, com folga para o rótulo e arredondada à
 *  dezena. A queda vai do mais fundo ao zero. */
export function thermometerDomain(
  rows: Pick<ThermometerRow, 'position'>[],
  metric: ThermometerMetric
): [number, number] {
  const positions = rows.map((row) => row.position)
  if (metric === 'drawdown') {
    return [Math.min(-10, Math.floor((Math.min(0, ...positions) - 5) / 10) * 10), 0]
  }
  const low = Math.min(50, ...positions) - 8
  const high = Math.max(50, ...positions) + 8
  return [Math.max(0, Math.floor(low / 10) * 10), Math.min(100, Math.ceil(high / 10) * 10)]
}

/** Variação do último ponto contra o último que havia `months` meses antes.
 *  Nulo quando a série não vai tão longe. */
export function changeOverMonths(points: ReadingPoint[], months: number): number | null {
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const start = new Date(`${last.date}T00:00:00`)
  start.setMonth(start.getMonth() - months)
  const from = start.toISOString().slice(0, 10)
  const before = points.filter((point) => point.date <= from)
  const base = before[before.length - 1]
  if (!base || base.value === 0) return null
  return last.value / base.value - 1
}

/** A máxima de um nível, a partir da queda desde o topo que o servidor mede
 *  sobre a série semanal inteira — o histórico que chega é mais ralo antes
 *  de cinco anos e poderia perder o pico. */
export const peakLevel = (reading: Pick<LevelReading, 'value' | 'drawdown'>) =>
  reading.value / (1 + reading.drawdown)
