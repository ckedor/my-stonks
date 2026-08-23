import { describe, expect, it } from 'vitest'
import { getNavigationGroups, navigationSections } from './navigation'

describe('getNavigationGroups', () => {
  it('adds the selected portfolio categories to the Carteira menu', () => {
    const carteira = navigationSections.find((section) => section.id === 'carteira')!

    const groups = getNavigationGroups(carteira, [
      { id: 10, name: 'Ações' },
      { id: 11, name: 'FIIs' },
    ])

    expect(groups.at(-1)).toEqual({
      title: 'Categorias',
      items: [
        { label: 'Ações', path: '/portfolio/category/10' },
        { label: 'FIIs', path: '/portfolio/category/11' },
      ],
    })
  })

  it('does not add an empty category column', () => {
    const carteira = navigationSections.find((section) => section.id === 'carteira')!

    expect(getNavigationGroups(carteira)).toBe(carteira.groups)
  })

  it('exposes the specialized market pages', () => {
    const mercado = navigationSections.find((section) => section.id === 'mercado')!

    expect(mercado.groups).toEqual([
      {
        title: 'Mercado',
        items: [
          { label: 'Visão geral', path: '/market/overview' },
          { label: 'Ativos', path: '/market/assets' },
        ],
      },
      {
        title: 'Categorias',
        items: [
          { label: 'Ações BR', path: '/market/stock' },
          { label: 'ETFs BR', path: '/market/etf' },
          { label: 'FIIs', path: '/market/fii' },
          { label: 'Cripto', path: '/market/crypto' },
        ],
      },
    ])
  })
})
