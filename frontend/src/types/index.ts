export interface BenchmarkEntry {
  id: number
  name: string
  short_name: string
}

export interface UserCategory {
  id: number
  name: string
  color: string
  benchmark_id: number | null
  benchmark: BenchmarkEntry
}

export interface Portfolio {
  id: number
  name: string
  user_id: number
  custom_categories: UserCategory[]
  portfolio_id: number
}

export interface Trade {
  id: number
  asset_id: number
  date: Date
  ticker: string
  type: string
  quantity: number
  price: number
  value: number
  average_price: number
  broker: string
  broker_id: number
  realized_profit: number
  acc_quantity: number
  position: number
  profit_pct: number
  portfolio_id: number
  original_price: number
  currency: string
}

/** Quando a carteira foi reconstruída, e se a corrida deu certo.
 *
 * `consolidated_at` é quando a corrida terminou, e não a data que os números
 * alcançam — essa é limitada pela última cotação ingerida. */
export interface PortfolioConsolidation {
  consolidated_at: string
  status: 'success' | 'partial' | 'failure'
  error: string | null
}

export interface ReturnsEntry {
  date: string
  value: number
}

export interface PortfolioReturnEntry {
  date: string
  daily_return: number
  acc_return: number
  cagr: number | null
}

export interface CategoryReturnEntry {
  date: string
  custom_category_id: number
  category: string
  daily_return: number
  acc_return: number
  cagr: number | null
}

/** Uma posição da carteira, com o que o ativo publica sobre si.
 *
 *  Os campos de subtipo vêm na mesma linha para todo ativo e são nulos fora do
 *  seu tipo: um CDB não tem segmento de FII, uma ação não tem indexador. É por
 *  eles que as telas especializadas leem a concentração do recorte, e é por
 *  isso que eles não moram em interfaces separadas — a linha é uma só. */
export interface PortfolioPositionEntry {
  asset_id: number
  date: string
  ticker: string
  name: string
  quantity: number
  average_price: number
  profit_pct: number
  category: string
  value: number
  price: number
  acc_return: number
  twelve_months_return: number
  cagr: number | null
  total_invested: number
  type: string
  type_id?: number
  class: string
  /** Bolsa em que o papel é negociado. Nula em quem não tem bolsa nenhuma. */
  exchange?: string | null
  /** Recorte especializado a que a posição pertence, ou nulo quando ela não
   *  está em nenhum. Quem resolve é o backend: a regra é uma só. */
  segment?: string | null
  fii_type?: string | null
  fii_segment?: string | null
  etf_segment?: string | null
  sector?: string | null
  industry?: string | null
  country?: string | null
  /** Remuneração, só em renda fixa. */
  index?: string | null
  fee?: number | null
  fixed_income_type?: string | null
  fixed_income_type_id?: number | null
}

export interface Dividend {
  id: number
  asset_id: number
  date: string
  ticker: string
  amount: number
  category: string
  portfolio_id: number
}

export interface PatrimonyEntry {
  date: string
  portfolio: number
  [key: string]: number | string | null
}

export interface Asset {
  id: number
  name: string
  ticker: string
  asset_type_id: number
  asset_type: {
    id: number
    name: string
    short_name: string
    asset_class: {
      id: number
      name: string
    }
  }
  quantity: number
  price: number
  average_price: number
  value: number
  acc_return: number | null
  twelve_months_return: number | null
  cagr?: number | null
  fixed_income?: {
    fee: number | null
    maturity_date: Date
    fixed_income_type_id?: number | null
    index?: { name: string; short_name?: string | null }
    fixed_income_type?: { name: string }
  }
  fund?: {
    anbima_category: string
    anbima_code: string
  }
  currency: {
    id: number
    name: string
  }
}

// Rebalancing types
export interface AssetRebalancingEntry {
  asset_id: number
  ticker: string
  name: string
  category: string
  category_id: number
  current_value: number
  current_pct_in_category: number
  target_pct_in_category: number | null
  target_value: number | null
  diff_pct: number | null
  diff_value: number | null
}

export interface CategoryRebalancingEntry {
  category_id: number
  category_name: string
  color: string
  current_value: number
  current_pct: number
  target_pct: number | null
  target_value: number | null
  diff_pct: number | null
  diff_value: number | null
  assets: AssetRebalancingEntry[]
}

export interface RebalancingResponse {
  portfolio_id: number
  total_value: number
  categories: CategoryRebalancingEntry[]
}

// Asset Analysis types
export interface BenchmarkMetrics {
  cagr: number
  alpha: number
  beta: number
  correlation: number
}

export interface DrawdownEntry {
  date: string
  drawdown: number
}

export interface DrawdownStats {
  max_drawdown: number
  max_drawdown_date: string
  peak_date_before_max_dd: string
  recovery_date: string | null
  recovery_days: number | null
  max_drawdown_duration_days: number | null
}

export interface RollingCagrEntry {
  date: string
  value: number
}

export interface AssetAnalysis {
  start_date: string
  performance_metrics: {
    cagr: number
    benchmarks_metrics: Record<string, BenchmarkMetrics>
  }
  risk_metrics: {
    annualized_vol: number
    sharpe_ratio: number
    drawdown: {
      series: DrawdownEntry[]
      stats: DrawdownStats
    }
    semideviation: number
    skewness: number
    kurtosis: number
    var_95: number
    cvar_95: number
  }
  rolling_cagr: RollingCagrEntry[]
}

/* Uma patente da escala. A escala é dado, editável pelo admin: nada aqui pode
   assumir uma quantidade de degraus nem um nome fixo. */
export interface WealthTier {
  id: number
  rank: number
  name: string
  threshold: number
  /** A ilustração do personagem, como data URI — a própria imagem, e não um
      caminho ou chave de storage. PNG e SVG são igualmente aceitos. */
  artwork: string | null
  /** Ajuste vertical em px, para o pé do personagem encostar na linha de base
      do layout. É dado da arte, não da tela: cada arquivo põe o personagem
      numa altura diferente, então nenhum valor único serve para todos. */
  artwork_offset: number
  /** Altura desenhada em px. Ausente usa o padrão da tela. */
  artwork_height: number | null
}

/* A posição da carteira na escala, a partir de dois números propositalmente
   diferentes.

   `peak_patrimony` é o maior valor que a carteira já teve, e é ele que decide
   `current_tier`: um degrau é alcançado uma vez e nunca se perde.

   `remaining` e `progress` saem de `current_patrimony`, porque quanto falta
   para subir é pergunta sobre hoje. Quem caiu mantém o título e enxerga a
   distância real que tem pela frente. */
export interface PortfolioWealthTier {
  peak_patrimony: number
  current_patrimony: number
  current_tier: WealthTier | null
  next_tier: WealthTier | null
  remaining: number | null
  progress: number
}
