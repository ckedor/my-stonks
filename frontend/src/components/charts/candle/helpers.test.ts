import { describe, expect, it } from 'vitest'

import { measureBetween } from './helpers'
import { readPriceScaleMode } from './persistence'

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
