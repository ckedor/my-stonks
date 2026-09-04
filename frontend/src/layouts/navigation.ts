/* Navegação do app fora do admin.
 *
 * Os mesmos dados desenham a coluna lateral do desktop e o drawer do mobile —
 * eram duas listas em `MainTopbar` e saíram de lá pelo mesmo motivo que a
 * do admin saiu: rota nova em um lugar só é rota que some do outro.
 *
 * A hierarquia é de dois níveis e cada um tem o seu lugar na tela: a seção
 * (Carteira, Mercado) são as abas da barra superior; os grupos e itens de
 * dentro dela são a coluna lateral.
 *
 * O grupo "Análise" da Carteira é a carteira inteira vista de cada ângulo, e
 * a lista dele é de propósito a mesma — mesmos nomes, mesma ordem — das abas
 * de um recorte em `PortfolioSliceScreen`. Quem aprende a ler uma categoria
 * sabe ler a carteira, e ver "Proventos" mudar de nome entre os dois níveis é
 * o tipo de diferença que só custa. `src/layouts/navigation.test.ts` é o que
 * prova que as duas listas não se separaram. */

import { PORTFOLIO_SEGMENT_LIST } from '@/constants/portfolioSegments'

export type SectionId = 'carteira' | 'mercado'

export interface NavigationItem {
  path: string
  label: string
  /** Destinos que só aparecem quando o item é aberto.
   *
   *  As categorias da carteira são uma lista de tamanho imprevisível, feita
   *  pelo usuário — deitá-la na coluna empurrava o resto da navegação para
   *  fora da dobra. Como submenu, ela é um item só até alguém querer
   *  escolher. */
  items?: NavigationItem[]
}

export interface NavigationGroup {
  title: string
  items: NavigationItem[]
}

export interface NavigationSection {
  id: SectionId
  label: string
  groups: NavigationGroup[]
}

/** O item que os dados do usuário preenchem. Ele fica declarado na lista
 *  estática para ter lugar fixo na ordem; sem categoria, ele é retirado. */
export const CATEGORIES_PATH = '/portfolio/category'

export const navigationSections: NavigationSection[] = [
  {
    id: 'carteira',
    label: 'Carteira',
    groups: [
      {
        title: 'Visão Geral',
        items: [
          { label: 'Resumo', path: '/portfolio/overview' },
          { label: 'Ativos', path: '/portfolio/asset' },
          { label: 'Categorias', path: CATEGORIES_PATH, items: [] },
        ],
      },
      {
        title: 'Análise',
        items: [
          { label: 'Rentabilidade', path: '/portfolio/returns' },
          { label: 'Patrimônio', path: '/portfolio/wealth' },
          { label: 'Proventos', path: '/portfolio/dividends' },
          { label: 'Trades', path: '/portfolio/trades' },
          { label: 'Distribuição', path: '/portfolio/distribution' },
          { label: 'Risco', path: '/portfolio/analysis' },
        ],
      },
      {
        title: 'Especializadas',
        items: PORTFOLIO_SEGMENT_LIST.map((segment) => ({
          label: segment.label,
          path: segment.path,
        })),
      },
      {
        title: 'Jornada',
        items: [{ label: 'Jornada do Herói', path: '/portfolio/tiers' }],
      },
      {
        title: 'Operações',
        items: [{ label: 'Declaração IR', path: '/portfolio/tax-income' }],
      },
    ],
  },
  {
    id: 'mercado',
    label: 'Mercado',
    groups: [
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
          { label: 'Bolsa BR', path: '/market/br' },
          { label: 'Bolsa EUA', path: '/market/us' },
          { label: 'FIIs', path: '/market/fii' },
          { label: 'Fundos', path: '/market/investment-fund' },
          { label: 'Cripto', path: '/market/crypto' },
        ],
      },
      /* A simulação fica sob `/market` e não sob uma raiz própria porque
         `getNavigationSection` decide a seção pelo prefixo da rota: um `/lab`
         abriria com a coluna da Carteira. */
      {
        title: 'Simulação',
        items: [
          { label: 'Laboratório', path: '/market/laboratory' },
          { label: 'Comparador', path: '/market/laboratory/compare' },
        ],
      },
    ],
  },
]

/** Preenche o submenu de Categorias com as categorias da carteira.
 *
 *  Escolher a categoria é a navegação, e não algo que se faz depois de chegar:
 *  o item abre a lista, e cada categoria é um destino. Sem nenhuma, o item
 *  sai da coluna em vez de abrir um menu vazio. */
export function withCategories(
  section: NavigationSection,
  categories: NavigationItem[],
): NavigationGroup[] {
  if (section.id !== 'carteira') return section.groups

  return section.groups.map((group) => ({
    ...group,
    items: group.items.flatMap((item) => {
      if (item.path !== CATEGORIES_PATH) return [item]
      return categories.length === 0 ? [] : [{ ...item, items: categories }]
    }),
  }))
}

/** Os grupos de uma seção já com o que vem dos dados do usuário. É por onde a
 *  coluna do desktop e o drawer do mobile passam, para não divergirem.
 *
 *  Os mais acessados não entram aqui: eles são uma prateleira dentro da tela
 *  de Ativos, onde cada um vem com nome, tipo e o que fazer com ele. Repetidos
 *  na coluna viravam uma lista de tickers soltos — a mesma informação, com
 *  menos contexto e ocupando a altura que os destinos fixos precisam. */
export function resolveGroups(
  section: NavigationSection,
  data: { categories?: NavigationItem[] },
): NavigationGroup[] {
  return withCategories(section, data.categories ?? [])
}

/** Para onde a aba da seção leva. É o primeiro item do primeiro grupo, em vez
 *  de uma rota escrita à parte: assim não há um segundo lugar para esquecer
 *  de atualizar quando a ordem da seção mudar. */
export function getSectionDefaultPath(section: NavigationSection): string {
  return section.groups[0].items[0].path
}

export function getNavigationSection(pathname: string): SectionId {
  return pathname.startsWith('/market') ? 'mercado' : 'carteira'
}

/** Todos os destinos declarados, do mais específico para o mais genérico. */
const DECLARED_PATHS = navigationSections
  .flatMap((section) => section.groups)
  .flatMap((group) => group.items)
  .map((item) => item.path)

/** Se o item da coluna corresponde à rota aberta.
 *
 *  O prefixo sozinho não serve: `/market/laboratory/compare` começa com
 *  `/market/laboratory`, e os dois itens acendiam ao mesmo tempo. Um item só
 *  ganha por prefixo quando nenhum destino mais específico também casa — o que
 *  mantém `/portfolio/category/11` acendendo Categorias, já que ali o trecho
 *  extra é um id e não outra tela. */
export function isNavigationItemActive(pathname: string, path: string): boolean {
  if (pathname === path) return true
  if (!pathname.startsWith(path + '/')) return false

  return !DECLARED_PATHS.some(
    (other) =>
      other.length > path.length &&
      (pathname === other || pathname.startsWith(other + '/')),
  )
}
