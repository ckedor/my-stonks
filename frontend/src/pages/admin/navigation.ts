export interface AdminNavigationItem {
  label: string
  path: string
  /** O assunto do item dentro da seção; vira um título no menu lateral. */
  group?: string
}

export interface AdminNavigationSection {
  id: string
  label: string
  defaultPath: string
  items: AdminNavigationItem[]
}

export const INTEGRATIONS_PATH = '/admin/integrations'

/* Tudo o que sincroniza ou integra dado de fora mora em Integrações, com o
 * painel à frente: é onde se vê o que roda, quando, e como terminou. As outras
 * seções são o que se edita ou consulta à mão. Os rótulos das rotinas são os
 * nomes do catálogo do backend (`operations/domain/routines.py`), e o título
 * de cada tela é o rótulo dela aqui. */
export const adminNavigationSections: AdminNavigationSection[] = [
  {
    id: 'integrations',
    label: 'Integrações',
    defaultPath: INTEGRATIONS_PATH,
    items: [
      { group: 'Monitoramento', label: 'Painel', path: INTEGRATIONS_PATH },
      { group: 'Monitoramento', label: 'Execuções', path: `${INTEGRATIONS_PATH}/runs` },
      { group: 'Dados de mercado', label: 'Cotações', path: `${INTEGRATIONS_PATH}/quotes` },
      {
        group: 'Dados de mercado',
        label: 'Séries de mercado',
        path: `${INTEGRATIONS_PATH}/market-series`,
      },
      { group: 'Dados de mercado', label: 'Dólar (USD/BRL)', path: `${INTEGRATIONS_PATH}/usd-brl` },
      {
        group: 'Dados de mercado',
        label: 'Valores de cota (CVM)',
        path: `${INTEGRATIONS_PATH}/fund-share-values`,
      },
      {
        group: 'Dados de mercado',
        label: 'Carteira dos ETFs',
        path: `${INTEGRATIONS_PATH}/etf-holdings`,
      },
      {
        group: 'Cadastros de referência',
        label: 'Cadastro de fundos (CVM)',
        path: `${INTEGRATIONS_PATH}/fund-registry`,
      },
      {
        group: 'Cadastros de referência',
        label: 'Cadastro de ETFs estrangeiros',
        path: `${INTEGRATIONS_PATH}/etf-registry`,
      },
      {
        group: 'Cadastros de referência',
        label: 'Catálogo de ativos',
        path: `${INTEGRATIONS_PATH}/asset-catalogue`,
      },
      {
        group: 'Cadastros de referência',
        label: 'Companhias e emissores (CVM)',
        path: `${INTEGRATIONS_PATH}/company-registry`,
      },
      {
        group: 'Cadastros de referência',
        label: 'Vínculo de FIIs e ETFs brasileiros',
        path: `${INTEGRATIONS_PATH}/fund-links`,
      },
      {
        group: 'Carteiras',
        label: 'Consolidação das carteiras',
        path: `${INTEGRATIONS_PATH}/consolidation`,
      },
    ],
  },
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
    label: 'Dados de mercado',
    defaultPath: '/admin/market-data/quotes',
    items: [
      { label: 'Histórico de cotações', path: '/admin/market-data/quotes' },
      { label: 'Histórico das séries', path: '/admin/market-data/series' },
      { label: 'Histórico do dólar', path: '/admin/market-data/usd-brl' },
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
    items: [
      { label: 'Funcionalidades', path: '/admin/ai-features' },
      { label: 'Uso e custo', path: '/admin/ai-usage' },
    ],
  },
  {
    id: 'storage',
    label: 'Armazenamento',
    defaultPath: '/admin/storage',
    items: [{ label: 'Banco de dados', path: '/admin/storage' }],
  },
  {
    id: 'users',
    label: 'Usuários',
    defaultPath: '/admin/users',
    items: [{ label: 'Usuários', path: '/admin/users' }],
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

/* Itens seguidos do mesmo grupo ficam sob um título só; a seção sem grupos
 * vira um grupo com o nome dela. É a lista que a coluna e o drawer do celular
 * desenham, e por isso mora aqui. */
export function groupAdminItems(
  section: AdminNavigationSection,
): { title: string; items: AdminNavigationItem[] }[] {
  const groups: { title: string; items: AdminNavigationItem[] }[] = []
  for (const item of section.items) {
    const title = item.group ?? section.label
    const last = groups[groups.length - 1]
    if (last?.title === title) last.items.push(item)
    else groups.push({ title, items: [item] })
  }
  return groups
}

/* O item mais específico que casa com a rota: `/admin/integrations` é o
 * painel, e não deve ficar marcado quando se está numa rotina abaixo dele. */
export function getActiveAdminPath(
  section: AdminNavigationSection,
  pathname: string,
): string | undefined {
  return section.items
    .map((item) => item.path)
    .filter((path) => pathname === path || pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0]
}
