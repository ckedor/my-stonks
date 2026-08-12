import { describe, expect, it } from 'vitest'

import { candleAt, formatSpan, measureBetween, type CandleDataPoint } from './helpers'
import { readPriceScaleMode } from './persistence'

const bar = (time: string, close: number): CandleDataPoint => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
})

describe('measureBetween', () => {
  it('reports the change from the earlier anchor to the later one', () => {
    const measurement = measureBetween(
      { time: '2026-01-01', price: 100 },
      { time: '2026-01-31', price: 125 },
    )

    expect(measurement).toEqual({ variation: 0.25, absolute: 25, days: 30 })
  })

  it('takes the earlier anchor as the baseline whichever order they are picked in', () => {
    const forwards = measureBetween(
      { time: '2026-01-01', price: 100 },
      { time: '2026-01-31', price: 125 },
    )
    const backwards = measureBetween(
      { time: '2026-01-31', price: 125 },
      { time: '2026-01-01', price: 100 },
    )

    expect(backwards).toEqual(forwards)
  })

  it('reports a fall as a negative change', () => {
    const measurement = measureBetween(
      { time: '2026-01-01', price: 200 },
      { time: '2026-01-02', price: 150 },
    )

    expect(measurement?.variation).toBeCloseTo(-0.25)
    expect(measurement?.absolute).toBe(-50)
  })

  it('declines to measure from a baseline where a percentage says nothing', () => {
    expect(measureBetween({ time: '2026-01-01', price: 0 }, { time: '2026-01-02', price: 10 }))
      .toBeNull()
  })
})

describe('readPriceScaleMode', () => {
  it('prefers the stored mode', () => {
    expect(readPriceScaleMode({ priceScaleMode: 'percent', logScale: true })).toBe('percent')
  })

  it('upgrades the log boolean that came before it', () => {
    expect(readPriceScaleMode({ logScale: true })).toBe('log')
  })

  it('leaves the default alone when nothing was stored', () => {
    expect(readPriceScaleMode({})).toBeUndefined()
    expect(readPriceScaleMode({ logScale: false })).toBeUndefined()
  })
})

describe('candleAt', () => {
  const data = [bar('2026-01-01', 10), bar('2026-01-02', 20), bar('2026-01-03', 30)]

  it('snaps to the nearest candle rather than flooring to the previous one', () => {
    // 1.6 is closer to bar 2 than to bar 1; flooring is what made a click land
    // one candle to the left.
    expect(candleAt(data, 1.6)?.time).toBe('2026-01-03')
    expect(candleAt(data, 1.4)?.time).toBe('2026-01-02')
  })

  it('clamps a click in the whitespace beside the series', () => {
    expect(candleAt(data, -5)?.time).toBe('2026-01-01')
    expect(candleAt(data, 99)?.time).toBe('2026-01-03')
  })

  it('has nothing to snap to without data or a logical index', () => {
    expect(candleAt([], 1)).toBeNull()
    expect(candleAt(data, null)).toBeNull()
    expect(candleAt(data, undefined)).toBeNull()
    expect(candleAt(data, NaN)).toBeNull()
  })
})

describe('formatSpan', () => {
  it('uses the coarsest unit that still reads precisely', () => {
    expect(formatSpan(1)).toBe('1 dia')
    expect(formatSpan(12)).toBe('12 dias')
    expect(formatSpan(30)).toBe('1 mês')
    expect(formatSpan(90)).toBe('3 meses')
    expect(formatSpan(365)).toBe('1,0 ano')
    expect(formatSpan(548)).toBe('1,5 anos')
    expect(formatSpan(365 * 23)).toBe('23 anos')
  })
})
