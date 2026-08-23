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
      { label: 'Patentes', path: '/admin/wealth-tiers' },
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
    defaultPath: '/admin/quote-ingestion',
    items: [
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
    id: 'users',
    label: 'Usuários',
    defaultPath: '/admin/users',
    items: [{ label: 'Usuários', path: '/admin/users' }],
  },
  {
    id: 'system',
    label: 'Sistema',
    defaultPath: '/admin/ai-features',
    items: [
      { label: 'Recursos de IA', path: '/admin/ai-features' },
      { label: 'Design System', path: '/admin/design-system' },
      { label: 'Arquitetura', path: '/admin/architecture' },
    ],
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
