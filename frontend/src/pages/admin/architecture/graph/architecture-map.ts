import type {
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureRelation,
} from './types'

const node = (
  id: string,
  kind: ArchitectureNode['data']['kind'],
  title: string,
  subtitle?: string,
  details?: string[],
): ArchitectureNode => ({
  id,
  type: 'architecture',
  position: { x: 0, y: 0 },
  data: { kind, title, subtitle, details },
})

const edge = (
  id: string,
  source: string,
  target: string,
  relation: ArchitectureRelation,
): ArchitectureEdge => ({
  id,
  source,
  target,
  label: relation,
  data: { relation },
  type: 'smoothstep',
})

export const architectureNodes: ArchitectureNode[] = [
  node('scheduler', 'scheduler', 'Celery Beat', 'SCHEDULER', [
    'Cotações de ativos: 04:00',
    'Séries / USD-BRL: 05, 13, 21h',
    'Carteiras: 05, 13, 21h +5min',
  ]),
  node('queue', 'cache', 'Redis', 'FILA + CACHE', [
    'Broker do Celery',
    'Cache preenchido no miss',
  ]),

  node('held-task', 'task', 'ingest_quotes_for_held_assets', 'TASK · portfolio', [
    'Descobre os ativos em carteira',
    'Encadeia ingest_quotes',
  ]),
  node('quote-task', 'task', 'ingest_quotes', 'TASK · market_data', [
    'Recebe asset_ids prontos',
  ]),
  node('series-task', 'task', 'ingest_market_data_series', 'TASK · market_data'),
  node('usd-task', 'task', 'ingest_usd_brl', 'TASK · market_data', [
    'Grava usd_brl e brl_usd',
  ]),
  node('portfolio-task', 'task', 'consolidate_all_portfolios', 'TASK · portfolio'),

  node('market-module', 'module', 'Market Data', 'MÓDULO', [
    'Cotações · séries · USD/BRL',
    'Não depende de portfolio',
  ]),
  node('portfolio-module', 'module', 'Portfolio', 'MÓDULO', [
    'Operações · posições · retornos',
  ]),
  node('ai-module', 'module', 'IA e Usuários', 'MÓDULO', ['Artefatos', 'Autenticação']),

  node('quote-service', 'service', 'QuoteIngestionService', 'SERVIÇO', [
    'Ingere os ativos que recebe',
    'Não escolhe quais',
  ]),
  node('history-service', 'service', 'AssetQuoteHistoryService', 'SERVIÇO', [
    'Banco primeiro',
    'Provider como fallback',
    'Converte para a moeda pedida',
  ]),
  node('usd-brl-read-service', 'service', 'UsdBrlReadService', 'SERVIÇO', [
    'Tabela inteira em uma chave',
    'Fatia em memória por data',
  ]),
  node('persisted-read-service', 'service', 'PersistedQuoteReadService', 'SERVIÇO', [
    'Somente banco',
  ]),
  node('on-demand-read-service', 'service', 'OnDemandQuoteReadService', 'SERVIÇO', [
    'Somente provider · cache 2 min',
  ]),
  node('fii-profile-service', 'service', 'FIIProfileReadService', 'SERVIÇO', [
    'Perfil do FII em sete rotas do provedor',
    'Uma falha custa só a seção dela',
    'Somente provider · cache 6 h',
  ]),
  node('portfolio-service', 'service', 'PortfolioConsolidatorService', 'SERVIÇO', [
    'Lê cotações persistidas',
    'Recalcula posições e retornos',
  ]),
  node('ai-service', 'service', 'Serviços de IA', 'SERVIÇO'),

  node('uow', 'service', 'UnitOfWork', 'PERSISTÊNCIA', [
    'Única porta para o banco',
    'Um escopo por caso de uso',
  ]),
  node('postgres', 'database', 'PostgreSQL', 'BANCO', [
    'quote · market_data_series_history',
    'usd_brl_history · asset_visit',
    'transaction · position · dividend',
  ]),

  node('brapi', 'external', 'Brapi', 'EXTERNO · v2', [
    'Ações, BDR, ETF, FII',
    'Séries e moeda do ativo',
  ]),
  node('cryptocompare', 'external', 'CryptoCompare', 'EXTERNO', [
    'Cripto · histórico profundo',
    'Cota de 100 chamadas/mês',
  ]),
  node('bcb', 'external', 'Banco Central', 'EXTERNO', ['CDI · IPCA · PTAX']),
  node('openai', 'external', 'OpenAI', 'EXTERNO'),
  node('http-api', 'external', 'FastAPI', 'API HTTP', [
    'Mercado · carteira · admin',
  ]),
]

export const architectureEdges: ArchitectureEdge[] = [
  edge('scheduler-queue', 'scheduler', 'queue', 'publishes'),
  edge('queue-held-task', 'queue', 'held-task', 'consumes'),
  edge('queue-series-task', 'queue', 'series-task', 'consumes'),
  edge('queue-usd-task', 'queue', 'usd-task', 'consumes'),
  edge('queue-portfolio-task', 'queue', 'portfolio-task', 'consumes'),

  edge('held-quote-task', 'held-task', 'quote-task', 'triggers'),
  edge('held-portfolio-module', 'held-task', 'portfolio-module', 'calls'),
  edge('quote-task-service', 'quote-task', 'quote-service', 'calls'),
  edge('series-task-module', 'series-task', 'market-module', 'calls'),
  edge('usd-task-module', 'usd-task', 'market-module', 'calls'),
  edge('portfolio-task-service', 'portfolio-task', 'portfolio-service', 'calls'),

  edge('market-module-quote-service', 'market-module', 'quote-service', 'calls'),
  edge('market-module-history', 'market-module', 'history-service', 'calls'),
  edge('market-module-fii-profile', 'market-module', 'fii-profile-service', 'calls'),
  edge('history-persisted', 'history-service', 'persisted-read-service', 'calls'),
  edge('history-on-demand', 'history-service', 'on-demand-read-service', 'calls'),
  edge('portfolio-module-service', 'portfolio-module', 'portfolio-service', 'calls'),
  edge('ai-module-service', 'ai-module', 'ai-service', 'calls'),

  edge('quote-service-brapi', 'quote-service', 'brapi', 'reads'),
  edge('quote-service-crypto', 'quote-service', 'cryptocompare', 'reads'),
  edge('on-demand-brapi', 'on-demand-read-service', 'brapi', 'reads'),
  edge('fii-profile-brapi', 'fii-profile-service', 'brapi', 'reads'),
  edge('fii-profile-uow', 'fii-profile-service', 'uow', 'reads'),
  edge('fii-profile-cache', 'fii-profile-service', 'queue', 'caches'),
  edge('usd-task-bcb', 'usd-task', 'bcb', 'reads'),
  edge('series-task-bcb', 'series-task', 'bcb', 'reads'),
  edge('series-task-brapi', 'series-task', 'brapi', 'reads'),

  edge('quote-service-uow', 'quote-service', 'uow', 'writes'),
  edge('persisted-uow', 'persisted-read-service', 'uow', 'reads'),
  edge('portfolio-service-uow', 'portfolio-service', 'uow', 'reads/writes'),
  edge('ai-service-uow', 'ai-service', 'uow', 'reads/writes'),
  edge('uow-postgres', 'uow', 'postgres', 'reads/writes'),

  edge('history-usd-brl', 'history-service', 'usd-brl-read-service', 'calls'),
  edge('portfolio-service-usd-brl', 'portfolio-service', 'usd-brl-read-service', 'calls'),
  edge('usd-brl-uow', 'usd-brl-read-service', 'uow', 'reads'),
  edge('usd-brl-cache', 'usd-brl-read-service', 'queue', 'caches'),
  edge('usd-task-invalidates', 'usd-task', 'queue', 'invalidates'),
  edge('on-demand-cache', 'on-demand-read-service', 'queue', 'caches'),
  edge('portfolio-service-cache', 'portfolio-service', 'queue', 'caches'),
  edge('ai-service-openai', 'ai-service', 'openai', 'calls'),
  edge('http-market', 'http-api', 'market-module', 'calls'),
  edge('http-portfolio', 'http-api', 'portfolio-module', 'calls'),
  edge('http-ai', 'http-api', 'ai-module', 'calls'),
]

export function validateArchitectureMap(
  nodes: ArchitectureNode[] = architectureNodes,
  edges: ArchitectureEdge[] = architectureEdges,
): string[] {
  const ids = new Set(nodes.map((item) => item.id))
  const errors: string[] = []
  if (ids.size !== nodes.length) errors.push('Node IDs must be unique')
  for (const item of edges) {
    if (!ids.has(item.source)) errors.push(`Unknown edge source: ${item.source}`)
    if (!ids.has(item.target)) errors.push(`Unknown edge target: ${item.target}`)
  }
  return errors
}
