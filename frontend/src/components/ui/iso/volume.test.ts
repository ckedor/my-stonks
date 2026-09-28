import { describe, expect, it } from 'vitest'

import { LANDMARK_DIMENSIONS } from './supertall-landmarks'
import { isoPieceMeasure } from './volume'

describe('medida de uma peça', () => {
  it('a altura é a do modelo, em metros', () => {
    expect(isoPieceMeasure('centralParkTower').height).toBeCloseTo(LANDMARK_DIMENSIONS.centralParkTower.heightMeters, 0)
  })

  it('antena não conta na altura, como não conta no volume', () => {
    const taipei = isoPieceMeasure('taipei101').height
    expect(taipei).toBeLessThan(LANDMARK_DIMENSIONS.taipei101.heightMeters)
    expect(taipei).toBeGreaterThan(LANDMARK_DIMENSIONS.taipei101.heightMeters - 20)
  })

  it('árvore e chão não têm altura nem volume', () => {
    for (const recipe of ['tree', 'road', 'lawn'] as const) expect(isoPieceMeasure(recipe)).toEqual({ volume: 0, height: 0 })
  })
})
