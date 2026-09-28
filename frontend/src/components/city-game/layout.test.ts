import { describe, expect, it } from 'vitest'

import { CITY_CATALOG } from './catalog'
import { displacedAssets } from './layout'

const items = new Map(CITY_CATALOG.map(item => [item.id, item]))
const at = (id: string, item: string, x: number) => ({ id, item, x, y: 0, rotation: 0 as const })
const landUpTo = (limit: number) => (x: number) => x < limit

describe('reconciliação do mapa', () => {
  it('manda para A colocar a peça que ficou na água', () => {
    expect(displacedAssets([at('a', 'tree', 5), at('b', 'tree', 50)], items, 64, landUpTo(10))).toEqual(['b'])
  })

  it('deixa a decoração sobreposta onde o jogador a pôs', () => {
    expect(displacedAssets([at('a', 'tree', 5), at('b', 'tree', 5)], items, 64, landUpTo(64))).toEqual([])
  })
})
