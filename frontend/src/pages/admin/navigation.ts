export interface AdminNavigationItem {
  label: string
  path: string
}

export interface AdminNavigationSection {
  id: string
  label: string
  defaultPath: string
  items: AdminNavigationItem[]
}

export const adminNavigationSections: AdminNavigationSection[] = [
  {
    id: 'registrations',
    label: 'Cadastros',
    defaultPath: '/admin/assets',
    items: [
      { label: 'Ativos', path: '/admin/assets' },
      { label: 'Eventos', path: '/admin/events' },
      { label: 'Corretoras', path: '/admin/brokers' },
    ],
  },
  {
    id: 'market-data',
    label: 'Dados de Mercado',
    defaultPath: '/admin/market-data/usd-brl',
    items: [
      { label: 'Dólar', path: '/admin/market-data/usd-brl' },
      { label: 'Séries', path: '/admin/market-data/series' },
      { label: 'Cotações de ativos', path: '/admin/market-data/quotes' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrações',
    defaultPath: '/admin/asset-sync',
    items: [
      { label: 'Sincronização de ativos', path: '/admin/asset-sync' },
      { label: 'Importação de cotações', path: '/admin/quote-ingestion' },
      {
        label: 'Séries de mercado',
        path: '/admin/market-data-series-ingestion',
      },
      { label: 'USD/BRL', path: '/admin/usd-brl-ingestion' },
      { label: 'Consolidação', path: '/admin/consolidation' },
    ],
  },
  {
    id: 'research',
    label: 'Pesquisa',
    defaultPath: '/admin/recommended-portfolios',
    items: [{ label: 'Carteiras recomendadas', path: '/admin/recommended-portfolios' }],
  },
  {
    id: 'ai',
    label: 'IA',
    defaultPath: '/admin/ai-features',
    items: [{ label: 'Recursos de IA', path: '/admin/ai-features' }],
  },
  {
    id: 'users',
    label: 'Usuários',
    defaultPath: '/admin/users',
    items: [{ label: 'Usuários', path: '/admin/users' }],
  },
  {
    id: 'design-system',
    label: 'Design System',
    defaultPath: '/admin/design-system',
    items: [{ label: 'Design System', path: '/admin/design-system' }],
  },
]

export function getAdminNavigationSection(pathname: string): AdminNavigationSection {
  return (
    adminNavigationSections.find((section) =>
      section.items.some(
        (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
      ),
    ) ?? adminNavigationSections[0]
  )
}
