import { describe, expect, it } from 'vitest'
import { navigationSections } from './navigation'

describe('navigationSections', () => {
  it('reaches the categories through a single page', () => {
    const carteira = navigationSections.find((section) => section.id === 'carteira')!
    const paths = carteira.groups.flatMap((group) => group.items.map((item) => item.path))

    expect(paths).toContain('/portfolio/category')
    expect(paths.filter((path) => path.startsWith('/portfolio/category'))).toHaveLength(1)
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
