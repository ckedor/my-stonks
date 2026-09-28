import { describe, expect, it } from 'vitest'

import { isoTerrainAvailability } from '@/components/ui'
import { regionAvailability } from '@/components/ui/iso/terrain'

import { CITY_MAP, CITY_MAP_SIZE, CITY_REGIONS, type CityRegion } from './map'
import { TERRITORY_STAGES, territoryOf } from './territory'
import { CITY_TIERS } from './tiers'

const regions = Object.keys(CITY_REGIONS) as CityRegion[]
const isLand = isoTerrainAvailability(CITY_MAP, CITY_MAP_SIZE)
const STEP = 8
const landCells: [number, number][] = []
for (let x = 0; x < CITY_MAP_SIZE; x += STEP) for (let y = 0; y < CITY_MAP_SIZE; y += STEP) if (isLand(x, y)) landCells.push([x, y])
const inRegion = Object.fromEntries(regions.map(region => [region, regionAvailability(CITY_REGIONS[region], CITY_MAP_SIZE)]))

describe('regiões do mapa', () => {
  it('não se sobrepõem: cada pedaço de terra abre uma vez só', () => {
    for (const [x, y] of landCells) expect(regions.filter(region => inRegion[region](x, y)).length).toBeLessThanOrEqual(1)
  })

  it('cada uma tem terra onde construir', () => {
    for (const region of regions) expect(landCells.some(([x, y]) => inRegion[region](x, y))).toBe(true)
  })

  it('juntas cobrem quase toda a terra do tabuleiro', () => {
    const covered = landCells.filter(([x, y]) => regions.some(region => inRegion[region](x, y)))
    expect(covered.length / landCells.length).toBeGreaterThan(0.97)
  })
})

describe('território', () => {
  it('começa numa ilha menor, na primeira patente', () => {
    expect(TERRITORY_STAGES[0]).toMatchObject({ fromRank: 1, regions: ['south-cay'] })
    expect(territoryOf(1).buildable).toEqual(CITY_REGIONS['south-cay'])
  })

  it('expande raramente: de 5 a 10 vezes no jogo inteiro', () => {
    expect(TERRITORY_STAGES.length - 1).toBeGreaterThanOrEqual(5)
    expect(TERRITORY_STAGES.length - 1).toBeLessThanOrEqual(10)
  })

  it('abre em patentes que existem, em ordem, e a última abre o mapa inteiro', () => {
    const ranks = TERRITORY_STAGES.map(stage => stage.fromRank)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    for (const rank of ranks) expect(CITY_TIERS.some(tier => tier.rank === rank)).toBe(true)
    expect(TERRITORY_STAGES.at(-1)!.regions).toBe('all')
    expect(territoryOf(CITY_TIERS.at(-1)!.rank).buildable).toBeUndefined()
  })

  it('acumula as áreas e aponta a próxima', () => {
    const territory = territoryOf(12)
    expect(territory.opened.map(stage => stage.name)).toEqual(['Ilhota do Sul', 'Ilhas do Sul', 'Ilhas do Leste'])
    expect(territory.buildable).toHaveLength(6)
    expect(territory.next?.stage.name).toBe('Ilha Grande')
    expect(territory.next?.tier.rank).toBe(18)
  })
})
