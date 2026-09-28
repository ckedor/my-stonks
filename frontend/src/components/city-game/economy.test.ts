import { describe, expect, it } from 'vitest'

import { assetBuildingId, assetBuildingItem } from './asset-buildings'
import { CITY_CATALOG } from './catalog'
import { assetBuildingShop, cityBalance, holdingBuilding, upgradeFor, withPrices, type HoldingForCity } from './economy'

const catalog = withPrices(CITY_CATALOG)
const byId = new Map(catalog.map(item => [item.id, item]))
const price = (id: string) => byId.get(id)!.price!
const placed = (item: string) => ({ id: item, item, x: 0, y: 0, rotation: 0 as const })

const holding = (valueUsd: number): HoldingForCity => ({ assetId: 7, ticker: 'XPML11', name: 'XP Malls', assetType: 'FII', valueUsd })

describe('preço dos itens', () => {
  it('ruas e a árvore comum são de graça', () => {
    for (const id of ['road', 'avenue', 'boulevard', 'crossing', 'sidewalk', 'tree']) expect(price(id)).toBe(0)
  })

  it('item maior custa mais', () => {
    expect(price('diner')).toBeGreaterThan(0)
    expect(price('glass-tower')).toBeGreaterThan(price('walk-up'))
    expect(price('spiral-tower')).toBeGreaterThan(price('glass-tower'))
  })

  it('custa o volume na régua dos ativos: o Burj fica perto dos US$ 100 mil da âncora', () => {
    expect(price('spiral-tower')).toBeGreaterThan(90_000)
    expect(price('spiral-tower')).toBeLessThan(120_000)
  })
})

describe('saldo', () => {
  it('é patrimônio mais dividendos, menos o que está construído', () => {
    const items = new Map(byId)
    const balance = cityBalance({ patrimonyUsd: 20_000, dividendsUsd: 500 }, [placed('glass-tower'), placed('road')], items)
    expect(balance.spentUsd).toBe(price('glass-tower'))
    expect(balance.balanceUsd).toBe(20_500 - price('glass-tower'))
  })

  it('fica negativo quando o patrimônio cai abaixo do que foi gasto', () => {
    const balance = cityBalance({ patrimonyUsd: 1_000, dividendsUsd: 0 }, [placed('glass-tower')], byId)
    expect(balance.balanceUsd).toBeLessThan(0)
  })

  it('não cobra o prédio de um ativo', () => {
    const building = assetBuildingItem(holdingBuilding(holding(50_000)))
    const items = new Map([...byId, [building.id, building]])
    expect(cityBalance({ patrimonyUsd: 50_000, dividendsUsd: 0 }, [placed(building.id)], items).spentUsd).toBe(0)
  })
})

describe('prédio de ativo', () => {
  it('é um por ativo: some da loja enquanto está no mapa', () => {
    expect(assetBuildingShop([holding(5_000)], new Set())).toHaveLength(1)
    expect(assetBuildingShop([holding(5_000)], new Set([7]))).toHaveLength(0)
  })

  it('só oferece upgrade quando o ativo já vale mais um andar', () => {
    const onMap = assetBuildingId(holdingBuilding(holding(10_000)))
    expect(upgradeFor(onMap, new Map([[7, holding(10_001)]]))).toBeNull()
    expect(upgradeFor(onMap, new Map([[7, holding(8_000)]]))).toBeNull()
    expect(upgradeFor(onMap, new Map([[7, holding(30_000)]]))?.valueUsd).toBe(30_000)
  })

  it('de um ativo que saiu da carteira não oferece nada', () => {
    const onMap = assetBuildingId(holdingBuilding(holding(10_000)))
    expect(upgradeFor(onMap, new Map())).toBeNull()
  })
})
