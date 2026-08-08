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
    id: 'market-data',
    label: 'Market Data',
    defaultPath: '/admin/assets',
    items: [
      { label: 'Ativos', path: '/admin/assets' },
      { label: 'Eventos', path: '/admin/events' },
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
    ],
  },
  {
    id: 'registrations',
    label: 'Cadastros',
    defaultPath: '/admin/brokers',
    items: [{ label: 'Corretoras', path: '/admin/brokers' }],
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
