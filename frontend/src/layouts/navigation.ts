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

/** O grupo que os dados do usuário preenchem. Ele fica declarado na lista
 *  estática para ter lugar fixo na ordem; vazio, ele é retirado. */
const CATEGORIES_GROUP_TITLE = 'Categorias'

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
      { title: CATEGORIES_GROUP_TITLE, items: [] },
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
          { label: 'Ações BR', path: '/market/stock' },
          { label: 'ETFs BR', path: '/market/etf' },
          { label: 'FIIs', path: '/market/fii' },
          { label: 'Cripto', path: '/market/crypto' },
        ],
      },
    ],
  },
]

/** Acrescenta ao Mercado os ativos mais visitados. Vem dos dados do usuário e
 *  por isso não cabe na lista estática: só pode ser montado depois que os
 *  favoritos carregarem. Sem nenhum, devolve a mesma referência da lista. */
export function withMostVisited(
  section: NavigationSection,
  favorites: NavigationItem[],
): NavigationGroup[] {
  if (section.id !== 'mercado' || favorites.length === 0) return section.groups

  /* Sem a contagem de visitas: ela ordena a lista, não é algo que se veio
     aqui para ler. */
  return [...section.groups, { title: 'Mais acessados', items: favorites }]
}

/** Preenche o grupo Categorias com as categorias da carteira.
 *
 *  Escolher a categoria é a navegação, e não algo que se faz depois de chegar:
 *  o menu abre a lista, e cada categoria é um destino. Sem nenhuma, o grupo
 *  vazio sai da coluna em vez de virar um título sem conteúdo. */
export function withCategories(
  section: NavigationSection,
  categories: NavigationItem[],
): NavigationGroup[] {
  if (section.id !== 'carteira') return section.groups

  return section.groups.flatMap((group) => {
    if (group.title !== CATEGORIES_GROUP_TITLE) return [group]
    return categories.length === 0 ? [] : [{ ...group, items: categories }]
  })
}

/** Os grupos de uma seção já com o que vem dos dados do usuário. É por onde a
 *  coluna do desktop e o drawer do mobile passam, para não divergirem. */
export function resolveGroups(
  section: NavigationSection,
  data: { categories?: NavigationItem[]; favorites?: NavigationItem[] },
): NavigationGroup[] {
  const withUserCategories = withCategories(section, data.categories ?? [])
  const groups = withMostVisited({ ...section, groups: withUserCategories }, data.favorites ?? [])
  return groups
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

export function isNavigationItemActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + '/')
}
