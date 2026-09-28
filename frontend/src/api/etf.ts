import { ETF_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

/* A página de mercado de um ETF: o fundo como o regulador o registra e o que
 * ele possui. Espelha `backend/app/modules/market_data/api/etf/schemas.py`. */

export type EtfRegistry = 'sec' | 'esma' | 'cvm'

export interface EtfLegalEntity {
  name: string
  lei: string | null
  cnpj: string | null
  country: string | null
}

export interface EtfProfile {
  registry: EtfRegistry | null
  fund: {
    name: string
    lei: string | null
    sec_series_id: string | null
    domicile: string
    status: string
    tracks_index: boolean | null
    leveraged_or_inverse: boolean | null
    fund_of_funds: boolean | null
    umbrella: EtfLegalEntity | null
    managers: EtfLegalEntity[]
  } | null
  share_class: {
    name: string
    ticker: string | null
    isin: string | null
    sec_class_id: string | null
    currency: string | null
    distribution_policy: 'accumulating' | 'distributing' | 'mixed' | null
    cfi_code: string | null
    status: string
  } | null
  cvm_fund: {
    cnpj: string
    name: string
    status: string
    started_at: string | null
    administrator_name: string | null
    manager_name: string | null
  } | null
  holdings: {
    report_date: string
    source: string
    net_assets: number | null
    total_assets: number | null
    holdings_count: number
    fetched_at: string | null
  } | null
  /** Se algum regulador publica o que este ETF possui. */
  holdings_available: boolean
}

export interface EtfHolding {
  rank: number
  name: string
  isin: string | null
  ticker: string | null
  asset_id: number | null
  asset_category: string | null
  country: string | null
  currency: string | null
  balance: number | null
  units: string | null
  value_usd: number | null
  /** Do patrimônio líquido, como razão: 0,08 é 8%. */
  weight: number | null
}

export interface EtfHoldingsPage {
  report_date: string | null
  source: string | null
  total: number
  page: number
  page_size: number
  items: EtfHolding[]
}

export const fetchEtfProfile = (assetId: number) =>
  api.get<EtfProfile>(ETF_ROUTES.profile(assetId)).then((response) => response.data)

export const fetchEtfHoldings = (assetId: number, page: number, pageSize: number) =>
  api
    .get<EtfHoldingsPage>(ETF_ROUTES.holdings(assetId), {
      params: { page, page_size: pageSize },
    })
    .then((response) => response.data)
