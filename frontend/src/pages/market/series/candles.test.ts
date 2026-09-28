import { describe, expect, it } from 'vitest'
import { seriesHistoryToCandleData } from './candles'

const point = (date: string, close: number | null) => ({
  date,
  close,
  open: null,
  high: null,
  low: null,
  source: null,
})

describe('series candles', () => {
  it('draws an index as its own level', () => {
    const data = seriesHistoryToCandleData({ series_type: 'market_index', frequency: 'daily' }, [
      point('2026-09-24', 16000),
      point('2026-09-25', null),
    ])

    expect(data).toEqual([
      { time: '2026-09-24', open: 16000, high: 16000, low: 16000, close: 16000 },
    ])
  })

  it('draws a daily interest rate per year, skipping days without a session', () => {
    const data = seriesHistoryToCandleData({ series_type: 'interest_rate', frequency: 'daily' }, [
      point('2026-04-02', 0.05),
      point('2026-04-03', 0),
    ])

    expect(data.map((candle) => candle.time)).toEqual(['2026-04-02'])
    expect(data[0].close).toBeCloseTo(1.0005 ** 252 - 1)
  })
})
