import { LAB_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import type { AssetAnalysis } from '@/types'

/** Com que passo um aporte ou um rebalanceamento se repete.
 *
 *  Os dois andam no mesmo calendário, então é uma lista só. `none` significa
 *  coisas diferentes em cada um: sem aporte, só o valor inicial trabalha; sem
 *  rebalanceamento, quem corrige a carteira são os aportes. */
export type Frequency = 'none' | 'monthly' | 'quarterly' | 'semiannual' | 'annual'

/** O tipo de rentabilidade de uma linha de renda fixa sintética. É o mesmo
 *  `fixed_income_type` da renda fixa cadastrada — 1 prefixado, 2 índice mais
 *  spread, 3 percentual do índice. */
export const FIXED_INCOME_TYPE = {
  fixedRate: 1,
  indexPlus: 2,
  percentOfIndex: 3,
} as const

/** Uma linha da carteira teórica, e as três maneiras de virar preço: um ativo
 *  cadastrado, uma série de mercado como índice, ou uma série com tipo de
 *  rentabilidade e taxa, que é renda fixa sintética. */
export interface TheoreticalPosition {
  id: number | null
  weight: number
  asset_id: number | null
  series_id: number | null
  fixed_income_type_id: number | null
  rate: number | null
  label: string | null
}

export interface TheoreticalPortfolio {
  id: number
  name: string
  initial_amount: number
  contribution_amount: number
  contribution_frequency: Frequency
  rebalance_frequency: Frequency
  benchmark_id: number | null
  positions: TheoreticalPosition[]
}

export interface SaveTheoreticalPosition {
  weight: number
  asset_id?: number | null
  series_id?: number | null
  fixed_income_type_id?: number | null
  rate?: number | null
  label?: string | null
}

export interface SaveTheoreticalPortfolio {
  name: string
  initial_amount: number
  contribution_amount: number
  contribution_frequency: Frequency
  rebalance_frequency: Frequency
  benchmark_id: number | null
  positions: SaveTheoreticalPosition[]
}

export interface PresetLine {
  label: string
  series_id: number
  weight: number
  fixed_income_type_id: number | null
  rate: number | null
}

export interface Preset {
  key: string
  name: string
  description: string
  contribution_frequency: Frequency
  rebalance_frequency: Frequency
  lines: PresetLine[]
}

export interface RunBacktest {
  positions: SaveTheoreticalPosition[]
  currency?: string
  initial_amount: number
  contribution_amount: number
  contribution_frequency: Frequency
  rebalance_frequency: Frequency
  start_date?: string | null
  years?: number | null
  end_date?: string | null
  benchmark_ids?: number[]
  label?: string | null
}

export interface BacktestPoint {
  date: string
  value: number
  invested: number
  acc_return: number
}

export interface BacktestLine {
  key: string
  label: string
  target_weight: number
  final_weight: number
  final_value: number
}

/** A janela que a simulação conseguiu rodar, e por que não foi maior.
 *
 *  `limited_by` é a linha que impôs o começo — a mais nova da carteira. Nula
 *  quando quem mandou foi a data pedida, e não a falta de preço. */
export interface BacktestWindow {
  start_date: string
  end_date: string
  limited_by: string | null
  requested_start_date: string | null
}

export interface BacktestResult {
  label: string | null
  window: BacktestWindow
  series: BacktestPoint[]
  lines: BacktestLine[]
  final_value: number
  invested: number
  profit: number
  contributions: number
  rebalances: number
  /** O mesmo payload que a carteira real entrega, para a tela ler os dois com
   *  os mesmos componentes. */
  analysis: AssetAnalysis | null
}

export const fetchTheoreticalPortfolios = (): Promise<TheoreticalPortfolio[]> =>
  api.get<TheoreticalPortfolio[]>(LAB_ROUTES.portfolio).then((r) => r.data)

export const fetchPresets = (): Promise<Preset[]> =>
  api.get<Preset[]>(LAB_ROUTES.preset).then((r) => r.data)

export const createTheoreticalPortfolio = (
  data: SaveTheoreticalPortfolio,
): Promise<TheoreticalPortfolio> =>
  api.post<TheoreticalPortfolio>(LAB_ROUTES.portfolio, data).then((r) => r.data)

export const updateTheoreticalPortfolio = (
  id: number,
  data: SaveTheoreticalPortfolio,
): Promise<TheoreticalPortfolio> =>
  api.put<TheoreticalPortfolio>(LAB_ROUTES.portfolioById(id), data).then((r) => r.data)

export const deleteTheoreticalPortfolio = (id: number): Promise<void> =>
  api.delete(LAB_ROUTES.portfolioById(id)).then(() => undefined)

export const runBacktest = (data: RunBacktest): Promise<BacktestResult> =>
  api.post<BacktestResult>(LAB_ROUTES.backtest, data).then((r) => r.data)

export const compareBacktests = (runs: RunBacktest[]): Promise<BacktestResult[]> =>
  api.post<BacktestResult[]>(LAB_ROUTES.backtestComparison, { runs }).then((r) => r.data)
