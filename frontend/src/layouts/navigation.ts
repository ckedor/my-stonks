/* Navegação do app fora do admin.
 *
 * Os mesmos dados desenham a coluna lateral do desktop e o drawer do mobile —
 * eram duas listas em `MainTopbar` e saíram de lá pelo mesmo motivo que a
 * do admin saiu: rota nova em um lugar só é rota que some do outro.
 *
 * A hierarquia é de dois níveis e cada um tem o seu lugar na tela: a seção
 * (Carteira, Mercado) são as abas da barra superior; os grupos e itens de
 * dentro dela são a coluna lateral. */

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
          { label: 'Categorias', path: '/portfolio/category' },
          { label: 'Distribuição', path: '/portfolio/distribution' },
          { label: 'Patrimônio', path: '/portfolio/wealth' },
        ],
      },
      {
        title: 'Análise',
        items: [
          { label: 'Rentabilidade', path: '/portfolio/returns' },
          { label: 'Risco', path: '/portfolio/analysis' },
          { label: 'Rebalanceamento', path: '/portfolio/rebalancing' },
        ],
      },
      {
        title: 'Especializadas',
        items: [{ label: 'FIIs', path: '/portfolio/fii' }],
      },
      {
        title: 'Operações',
        items: [
          { label: 'Trades', path: '/portfolio/trades' },
          { label: 'Proventos', path: '/portfolio/dividends' },
          { label: 'Declaração IR', path: '/portfolio/tax-income' },
        ],
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

/** Acrescenta ao Mercado os ativos mais visitados. É o único grupo que vem
 *  dos dados do usuário, e por isso o único que não cabe na lista estática
 *  acima: só pode ser montado depois que os favoritos carregarem. Sem
 *  nenhum, devolve a mesma referência da lista estática. */
export function withMostVisited(
  section: NavigationSection,
  favorites: NavigationItem[],
): NavigationGroup[] {
  if (section.id !== 'mercado' || favorites.length === 0) return section.groups

  /* Sem a contagem de visitas: ela ordena a lista, não é algo que se veio
     aqui para ler. */
  return [...section.groups, { title: 'Mais acessados', items: favorites }]
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
