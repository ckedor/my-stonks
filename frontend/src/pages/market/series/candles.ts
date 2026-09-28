import type { MarketDataSeries, MarketDataSeriesHistoryPoint } from '@/api/market'
import type { CandleDataPoint } from '@/components/charts/CandleChart'

/** Uma linha só de fechamento: sem abertura, máxima e mínima, o candle vira
 *  um traço, e por isso quem desenha escolhe a linha. */
export function closesToCandleData(points: { date: string; close: number }[]): CandleDataPoint[] {
  return points.map((point) => ({
    time: point.date.slice(0, 10),
    open: point.close,
    high: point.close,
    low: point.close,
    close: point.close,
  }))
}

/** Se a série é uma taxa diária de juro — o CDI —, e por isso se lê ao ano. */
export const isDailyInterestRate = (series: Pick<MarketDataSeries, 'series_type' | 'frequency'>) =>
  series.series_type === 'interest_rate' && series.frequency === 'daily'

/** O que o gráfico de uma série desenha.
 *
 *  Um índice é o próprio nível. Uma taxa diária de juro é guardada em
 *  percentual ao dia, e com 0% nos dias sem pregão — certo para compor, e
 *  errado para desenhar: um gráfico de 0,05% com vales em zero a cada fim de
 *  semana. Ela vira a taxa ao ano que representa, só nos dias com pregão. */
export function seriesHistoryToCandleData(
  series: Pick<MarketDataSeries, 'series_type' | 'frequency'>,
  history: MarketDataSeriesHistoryPoint[],
): CandleDataPoint[] {
  if (!isDailyInterestRate(series)) {
    return history.flatMap((point) =>
      point.close == null
        ? []
        : [
            {
              time: point.date.slice(0, 10),
              open: point.open ?? point.close,
              high: point.high ?? point.close,
              low: point.low ?? point.close,
              close: point.close,
            },
          ],
    )
  }
  return closesToCandleData(
    history.flatMap((point) =>
      point.close == null || point.close <= 0
        ? []
        : [{ date: point.date, close: (1 + point.close / 100) ** 252 - 1 }],
    ),
  )
}
