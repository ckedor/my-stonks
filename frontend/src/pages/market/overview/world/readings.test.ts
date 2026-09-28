import { describe, expect, it } from 'vitest'
import {
  changeOverMonths,
  peakLevel,
  formatLevel,
  percentileZone,
  pointsInWindow,
  ratePerYear,
  readingHref,
  thermometerDomain,
  thermometerRows,
  signedPercent,
  windowChange,
} from './readings'

const point = (date: string, value: number) => ({ date, value, moving_average: null })

describe('world readings', () => {
  it('formats fractions as signed percentages and rates per year', () => {
    expect(signedPercent(0.134)).toBe('+13,4%')
    expect(signedPercent(-0.02)).toBe('-2,0%')
    expect(signedPercent(null)).toBe('—')
    expect(ratePerYear(0.1365)).toBe('13,65% a.a.')
  })

  it('writes each level in its own unit', () => {
    expect(formatLevel({ key: 'usd_brl', value: 5.2 })).toMatch(/R\$\s?5,20/)
    expect(formatLevel({ key: 'btc', value: 84368.25 })).toMatch(/US\$\s?84\.368/)
    expect(formatLevel({ key: 'msci_world', value: 16046.75 })).toBe('16.047')
    expect(formatLevel({ key: 'usa_vs_acwi_ex_usa', value: 175.9 })).toBe('175,9')
  })

  it('places a percentile in deciles and quintiles, and nowhere without history', () => {
    expect(percentileZone(0.95)).toBe('very-high')
    expect(percentileZone(0.7)).toBe('high')
    expect(percentileZone(0.5)).toBe('middle')
    expect(percentileZone(0.3)).toBe('low')
    expect(percentileZone(0.05)).toBe('very-low')
    expect(percentileZone(null)).toBeNull()
  })

  it('counts a window back from the last close before it, as the twelve months do', () => {
    // A year before 2026-09-25 is 2025-09-25, a Thursday: the base is the
    // Friday before it, the week the server measures "12 meses" against.
    const points = [
      point('2020-01-03', 50),
      point('2025-09-19', 100),
      point('2025-09-26', 104),
      point('2026-09-25', 121),
    ]

    expect(pointsInWindow(points, '1y').map((p) => p.date)).toEqual([
      '2025-09-19',
      '2025-09-26',
      '2026-09-25',
    ])
    expect(pointsInWindow(points, 'max')).toHaveLength(4)
    expect(windowChange(pointsInWindow(points, '1y'))).toBeCloseTo(0.21)
    expect(pointsInWindow(points.slice(2), '1y')).toHaveLength(2)
    expect(windowChange([point('2026-09-25', 1)])).toBeNull()
  })

  it('sends each card to the screen of what it reads', () => {
    expect(readingHref({ key: 'msci_acwi', series_id: 9 })).toBe('/market/series/9')
    expect(readingHref({ key: 'btc', series_id: null, asset_id: 13 })).toBe('/market/asset/13')
    expect(readingHref({ key: 'usd_brl', series_id: null, asset_id: null })).toBe('/market/usd-brl')
    expect(readingHref({ key: 'em_vs_world', series_id: null, asset_id: null })).toBeNull()
  })

  it('orders the thermometer from highest in its own history, and sets aside who cannot answer', () => {
    const reading = (key: string, distance: number, percentile: number | null, drawdown: number) =>
      ({
        key,
        distance_to_moving_average: distance,
        distance_percentile: percentile,
        ten_year_annualized_return: null,
        ten_year_return_percentile: null,
        drawdown,
      }) as unknown as Parameters<typeof thermometerRows>[0][number]
    const readings = [
      reading('msci_usa', 0.07, 0.7, -0.01),
      reading('msci_em', 0.08, 0.95, -0.2),
      reading('btc', 0.15, null, -0.3),
    ]

    const trend = thermometerRows(readings, 'trend')
    expect(trend.rows.map((row) => row.name)).toEqual(['Emergentes', 'EUA'])
    expect(trend.rows[0].position).toBeCloseTo(95)
    expect(trend.missing).toEqual(['Bitcoin'])

    const drawdown = thermometerRows(readings, 'drawdown')
    expect(drawdown.rows.map((row) => row.name)).toEqual(['Bitcoin', 'Emergentes', 'EUA'])

    expect(thermometerRows(readings, 'decade').rows).toEqual([])
  })

  it('measures the month against the last point a month back', () => {
    const points = [point('2026-08-21', 100), point('2026-08-28', 105), point('2026-09-25', 110)]

    // Um mês antes de 25/09 é 25/08: o último ponto até lá é o de 21/08.
    expect(changeOverMonths(points, 1)).toBeCloseTo(110 / 100 - 1)
    expect(changeOverMonths(points, 12)).toBeNull()
  })

  it('recovers the peak from the drawdown', () => {
    expect(peakLevel({ value: 84_368, drawdown: -0.31 })).toBeCloseTo(84_368 / 0.69)
    expect(peakLevel({ value: 637.66, drawdown: 0 })).toBe(637.66)
  })

  it('fits the thermometer ruler to where the markets are, always through the middle', () => {
    const at = (...positions: number[]) => positions.map((position) => ({ position }))

    expect(thermometerDomain(at(62, 78, 97), 'trend')).toEqual([40, 100])
    expect(thermometerDomain(at(55, 64), 'decade')).toEqual([40, 80])
    expect(thermometerDomain(at(3, 48), 'trend')).toEqual([0, 60])
    expect(thermometerDomain(at(-31.8, -0.4), 'drawdown')).toEqual([-40, 0])
    expect(thermometerDomain(at(-0.4), 'drawdown')).toEqual([-10, 0])
  })
})
