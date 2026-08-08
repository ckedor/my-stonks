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
    'Quotes: 04:00',
    'Series / USD: 05:00, 13:00, 21:00',
    'Portfolios: +5 min',
  ]),
  node('queue', 'cache', 'Redis', 'QUEUE + CACHE', ['Celery broker/results', 'Read caches']),
  node('quote-task', 'task', 'Quote Ingestion', 'TASK · scheduled/manual', ['Held assets']),
  node('series-task', 'task', 'Series Ingestion', 'TASK · scheduled/manual', [
    'Market series',
  ]),
  node('usd-task', 'task', 'USD/BRL Ingestion', 'TASK · scheduled/manual'),
  node('portfolio-task', 'task', 'Portfolio Consolidation', 'TASK · scheduled/manual', [
    'Uses persisted quotes',
  ]),
  node('market-module', 'module', 'Market Data', 'MODULE', ['Quotes', 'Series', 'USD/BRL']),
  node('portfolio-module', 'module', 'Portfolio', 'MODULE', ['Transactions', 'Positions', 'Returns']),
  node('ai-module', 'module', 'AI & Users', 'MODULE', ['Artifacts', 'Authentication']),
  node('quote-service', 'service', 'Quote Ingestion Service', 'SERVICE', [
    'Select · fetch · upsert',
  ]),
  node('persisted-read-service', 'service', 'Persisted Quote Reader', 'SERVICE', [
    'Database only',
  ]),
  node('on-demand-read-service', 'service', 'On-demand Quote Reader', 'SERVICE', [
    'Provider only · no writes',
  ]),
  node('portfolio-service', 'service', 'Portfolio Consolidator', 'SERVICE', [
    'Positions · returns',
  ]),
  node('ai-service', 'service', 'AI Feature Services', 'SERVICE'),
  node('postgres', 'database', 'PostgreSQL', 'DATABASE', [
    'quote · market_data_series_history',
    'usd_brl_history · ingestions',
    'portfolio · position · transaction',
  ]),
  node('market-apis', 'external', 'Market Data APIs', 'EXTERNAL', [
    'Brapi · BCB · Alpha Vantage',
    'Status Invest · CryptoCompare',
  ]),
  node('openai', 'external', 'OpenAI API', 'EXTERNAL'),
  node('http-api', 'external', 'FastAPI HTTP', 'APPLICATION API', [
    'Market · Portfolio · Admin',
  ]),
]

export const architectureEdges: ArchitectureEdge[] = [
  edge('scheduler-queue', 'scheduler', 'queue', 'publishes'),
  edge('queue-quote-task', 'queue', 'quote-task', 'consumes'),
  edge('queue-series-task', 'queue', 'series-task', 'consumes'),
  edge('queue-usd-task', 'queue', 'usd-task', 'consumes'),
  edge('queue-portfolio-task', 'queue', 'portfolio-task', 'consumes'),
  edge('quote-task-service', 'quote-task', 'quote-service', 'calls'),
  edge('series-task-module', 'series-task', 'market-module', 'calls'),
  edge('usd-task-module', 'usd-task', 'market-module', 'calls'),
  edge('portfolio-task-service', 'portfolio-task', 'portfolio-service', 'calls'),
  edge('market-module-quote-service', 'market-module', 'quote-service', 'calls'),
  edge('market-module-persisted-reader', 'market-module', 'persisted-read-service', 'calls'),
  edge('market-module-on-demand-reader', 'market-module', 'on-demand-read-service', 'calls'),
  edge('portfolio-module-service', 'portfolio-module', 'portfolio-service', 'calls'),
  edge('ai-module-service', 'ai-module', 'ai-service', 'calls'),
  edge('quote-service-provider', 'quote-service', 'market-apis', 'reads'),
  edge('quote-service-db', 'quote-service', 'postgres', 'writes'),
  edge('persisted-reader-db', 'persisted-read-service', 'postgres', 'reads'),
  edge('on-demand-reader-provider', 'on-demand-read-service', 'market-apis', 'reads'),
  edge('portfolio-persisted-reader', 'portfolio-service', 'persisted-read-service', 'calls'),
  edge('portfolio-service-db', 'portfolio-service', 'postgres', 'reads/writes'),
  edge('portfolio-service-cache', 'portfolio-service', 'queue', 'caches'),
  edge('ai-service-db', 'ai-service', 'postgres', 'reads/writes'),
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
