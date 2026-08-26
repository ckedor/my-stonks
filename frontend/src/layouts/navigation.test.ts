import { describe, expect, it } from 'vitest'
import { getSectionDefaultPath, navigationSections, withMostVisited } from './navigation'

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

describe('withMostVisited', () => {
  it('adds the most visited assets to the Mercado menu', () => {
    const mercado = navigationSections.find((section) => section.id === 'mercado')!

    expect(withMostVisited(mercado, [{ label: 'PETR4', path: '/market/asset/11' }]).at(-1)).toEqual({
      title: 'Mais acessados',
      items: [{ label: 'PETR4', path: '/market/asset/11' }],
    })
  })

  it('does not add an empty group', () => {
    const mercado = navigationSections.find((section) => section.id === 'mercado')!

    expect(withMostVisited(mercado, [])).toBe(mercado.groups)
  })

  it('leaves the Carteira alone', () => {
    const carteira = navigationSections.find((section) => section.id === 'carteira')!

    expect(withMostVisited(carteira, [{ label: 'PETR4', path: '/market/asset/11' }])).toBe(
      carteira.groups,
    )
  })
})

describe('getSectionDefaultPath', () => {
  /* A aba da barra superior navega para cá. Vem do primeiro item da seção em
     vez de uma rota à parte, e este teste é o que prova que a derivação
     continua acompanhando a lista quando a ordem dela muda. */
  it('is the first item of the first group', () => {
    expect(navigationSections.map(getSectionDefaultPath)).toEqual([
      '/portfolio/overview',
      '/market/overview',
    ])
  })
})
