import { describe, expect, it } from 'vitest'

import { isoPieceVolume, assetSculptureLayout, isoPieceSize } from '@/components/ui/city'
import {
  assetBuildingId, assetBuildingItem, assetBuildingItems, buildingTypeOf, parseAssetBuildingId, type AssetBuilding,
} from './asset-buildings'
import { upgradeFor } from './economy'

const bull: AssetBuilding = { type: 'ETF', ticker: 'IVV', valueUsd: 100, assetId: 42, material: 'gold' }

describe('esculturas dos ativos', () => {
  it('mantém o volume da escultura proporcional e a base em células inteiras', () => {
    const small = assetSculptureLayout(100, 'bull', 'IVV')
    const large = assetSculptureLayout(20_000, 'bull', 'IVV')
    expect((large.scale / small.scale) ** 3).toBeCloseTo(200, 6)
    expect((large.art / small.art) ** 3).toBeCloseTo(200, 6)
    expect(isoPieceSize(assetBuildingItem({ ...bull, valueUsd: 20_000 }).recipe)).toEqual([large.width, large.depth])
    expect(Number.isInteger(large.width) && Number.isInteger(large.depth)).toBe(true)
  })

  it.each([['Cripto', 'CRIPTO'], ['CRIPTO', 'CRIPTO'], ['Tesouro', 'TREASURY'],
    ['Ação', 'STOCK'], ['Previdência', 'FIXED_INCOME'], ['Debênture', 'FIXED_INCOME']])(
    'reconhece o tipo %s enviado pela carteira', (label, expected) => {
      expect(buildingTypeOf(label)).toBe(expected)
    },
  )

  it('corrige BTC salvo como ação para fênix, preservando material e valor', () => {
    const legacy = 'asset-building:STOCK:BTC:8600:13:glass'
    const items = assetBuildingItems([legacy], new Map([[13, buildingTypeOf('Cripto')]]))
    const saved = items.find(item => item.id === legacy)!
    const phoenix = assetBuildingItem({ type: 'CRIPTO', ticker: 'BTC', valueUsd: 8600, assetId: 13, material: 'glass' })
    expect(saved.variants).toBeUndefined()
    expect(isoPieceSize(saved.recipe)).toEqual(isoPieceSize(phoenix.recipe))
    expect(isoPieceVolume(saved.recipe)).toBeCloseTo(isoPieceVolume(phoenix.recipe), 6)
    expect(saved.unique).toBe('asset:13')
  })

  it('usa cores fixas na fênix e continua lendo materiais de cidades antigas', () => {
    const crypto = { type: 'CRIPTO' as const, ticker: 'BTC', valueUsd: 8600, assetId: 13 }
    const fresh = assetBuildingItem(crypto)
    const savedGold = assetBuildingItems([`${assetBuildingId(crypto)}:gold`])[0]
    expect(fresh.variants).toBeUndefined()
    expect(savedGold.id).toBe(`${assetBuildingId(crypto)}:gold`)
    expect(savedGold.variants).toBeUndefined()
    expect(isoPieceVolume(savedGold.recipe)).toBeCloseTo(isoPieceVolume(fresh.recipe), 6)
    expect(parseAssetBuildingId(`${assetBuildingId(crypto)}:fire`)?.material).toBe('fire')
  })

  it('separa FI de renda fixa e preserva prata em ativos antigos', () => {
    expect(buildingTypeOf('FI')).toBe('FI')
    expect(buildingTypeOf('CDB')).toBe('FIXED_INCOME')
    const legacy = 'asset-building:FIXED_INCOME:FUNDO:15000:81:silver'
    const saved = assetBuildingItems([legacy], new Map([[81, buildingTypeOf('FI')]]))[0]
    const octopus = assetBuildingItem({ type: 'FI', ticker: 'FUNDO', valueUsd: 15000, assetId: 81, material: 'silver' })
    expect(saved.variants?.selected).toBe(octopus.id)
    expect(saved.appearanceKey).toBe(octopus.appearanceKey)
    expect(isoPieceVolume(saved.recipe)).toBeCloseTo(isoPieceVolume(octopus.recipe), 6)
    expect(parseAssetBuildingId(octopus.id)?.material).toBe('silver')
  })

  it('o material não muda volume, patrimônio ou identidade do ativo', () => {
    const gold = assetBuildingItem(bull)
    const wood = assetBuildingItem({ ...bull, material: 'wood' })
    expect(isoPieceVolume(wood.recipe)).toBeCloseTo(isoPieceVolume(gold.recipe), 8)
    expect(wood.unique).toBe(gold.unique)
    expect(wood.price).toBe(0)
    expect(parseAssetBuildingId(wood.id)).toEqual({ ...bull, material: 'wood' })
  })

  it('lê ids anteriores aos materiais e usa a classe da carteira para ETFs antigos', () => {
    const legacy = 'asset-building:STOCK:IVV:100:42'
    expect(parseAssetBuildingId(legacy)).toEqual({ type: 'STOCK', ticker: 'IVV', valueUsd: 100, assetId: 42 })
    const items = assetBuildingItems([legacy], new Map([[42, 'ETF']]))
    expect(items.some(item => item.id === legacy)).toBe(true)
    expect(items.find(item => item.id === legacy)?.variants?.selected).toBe('asset-building:ETF:IVV:100:42:bronze')
  })

  it('preserva material no crescimento e no sandbox sem assetId', () => {
    const next = upgradeFor(assetBuildingId(bull), new Map([[42, {
      assetId: 42, ticker: 'IVV', name: 'IVV', assetType: 'ETF', valueUsd: 20_000,
    }]]))
    expect(next?.material).toBe('gold')
    expect(next?.valueUsd).toBe(20_000)
    const sandbox = { ...bull, assetId: undefined, material: 'glass' as const }
    expect(parseAssetBuildingId(assetBuildingId(sandbox))).toEqual(sandbox)
    expect(parseAssetBuildingId('asset-building:ETF:IVV:100:42:invalid')).toBeNull()
  })
})
