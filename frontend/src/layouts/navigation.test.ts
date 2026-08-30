import { describe, expect, it } from 'vitest'
import { SLICE_TABS } from '@/components/portfolio-slice/tabs'
import { PORTFOLIO_SEGMENT_LIST } from '@/constants/portfolioSegments'
import {
  getSectionDefaultPath,
  navigationSections,
  resolveGroups,
  withCategories,
} from './navigation'

const carteira = () => navigationSections.find((section) => section.id === 'carteira')!
const mercado = () => navigationSections.find((section) => section.id === 'mercado')!

const group = (title: string) => carteira().groups.find((item) => item.title === title)!

describe('navigationSections', () => {
  /* A promessa da reorganização: ler a carteira e ler um pedaço dela são a
     mesma leitura. Sem este teste, uma aba nova numa tela de recorte — ou um
     item novo no menu — separa as duas listas em silêncio, e o app volta a
     ter dois vocabulários para a mesma coisa. */
  it('names the portfolio-wide views exactly as a slice names its tabs', () => {
    expect(group('Análise').items.map((item) => item.label)).toEqual(
      SLICE_TABS.map((tab) => tab.label),
    )
  })

  it('reaches every specialized screen from the menu', () => {
    expect(group('Especializadas').items).toEqual(
      PORTFOLIO_SEGMENT_LIST.map((segment) => ({ label: segment.label, path: segment.path })),
    )
  })

  /* Distribuição e rebalanceamento viraram uma tela só: a rota antiga não
     pode voltar ao menu por descuido. */
  it('has no separate rebalancing entry', () => {
    const paths = carteira().groups.flatMap((item) => item.items.map((entry) => entry.path))

    expect(paths).not.toContain('/portfolio/rebalancing')
    expect(paths).toContain('/portfolio/distribution')
  })

  it('exposes the specialized market pages', () => {
    expect(mercado().groups).toEqual([
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

const flatItems = (groups: ReturnType<typeof withCategories>) =>
  groups.flatMap((group) => group.items)

const categoriesItem = (groups: ReturnType<typeof withCategories>) =>
  flatItems(groups).find((item) => item.path === '/portfolio/category')

describe('withCategories', () => {
  const items = [{ label: 'FIIs', path: '/portfolio/category/11' }]

  /* A coluna é curta e a lista de categorias é do usuário: deitá-la ali
     empurrava o resto da navegação para fora da dobra. Um item que abre. */
  it('hangs the categories off a single item instead of listing them', () => {
    const groups = withCategories(carteira(), items)

    expect(categoriesItem(groups)!.items).toEqual(items)
    expect(flatItems(groups).map((item) => item.path)).not.toContain(
      '/portfolio/category/11',
    )
    expect(groups.map((group) => group.title)).not.toContain('Categorias')
  })

  it('keeps the item in its declared place', () => {
    const paths = flatItems(withCategories(carteira(), items)).map((item) => item.path)

    expect(paths.indexOf('/portfolio/category')).toBe(paths.indexOf('/portfolio/asset') + 1)
  })

  /* Um item que abre um menu vazio não é navegação: sem categoria, ele sai. */
  it('drops the item when the portfolio has no category', () => {
    expect(categoriesItem(withCategories(carteira(), []))).toBeUndefined()
  })

  it('leaves the Mercado alone', () => {
    expect(withCategories(mercado(), items)).toBe(mercado().groups)
  })
})

describe('resolveGroups', () => {
  /* A coluna do desktop e o drawer do mobile passam por aqui justamente para
     não divergirem: o que uma mostra, a outra mostra. */
  it('is the one place the user data enters the menu', () => {
    const groups = resolveGroups(carteira(), {
      categories: [{ label: 'FIIs', path: '/portfolio/category/11' }],
    })

    expect(categoriesItem(groups)!.items).toHaveLength(1)
    /* Os mais acessados saíram da coluna: eles são a prateleira da tela de
       Ativos, onde cada um vem com nome e tipo. Aqui não entra nenhum grupo
       que não seja destino fixo ou categoria da carteira. */
    expect(groups.map((item) => item.title)).not.toContain('Mais acessados')
  })

  it('leaves the empty Categorias item out when there is nothing to fill it', () => {
    expect(categoriesItem(resolveGroups(carteira(), {}))).toBeUndefined()
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
