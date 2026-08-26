/* Navegação do app fora do admin.
 *
 * Os mesmos dados desenham os mega-menus do desktop e o drawer do mobile —
 * eram duas listas em `MainTopbar` e saíram de lá pelo mesmo motivo que a
 * do admin saiu: rota nova em um lugar só é rota que some do outro. */

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

export function getNavigationSection(pathname: string): SectionId {
  return pathname.startsWith('/market') ? 'mercado' : 'carteira'
}

export function isNavigationItemActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(path + '/')
}
