import { ASSET_ROUTES, FUND_REGISTRY_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

export interface FundRegistry {
  id: number
  registry_id: number
  cnpj: string
  name: string
  kind: string
  status: string
  started_at: string | null
  cancelled_at: string | null
  administrator_name: string | null
  administrator_cnpj: string | null
  manager_name: string | null
  manager_document: string | null
}

export interface FundRegistryClass {
  id: number
  registry_id: number
  fund_registry_id: number
  cnpj: string
  name: string
  class_type: string | null
  status: string | null
  classification: string | null
  anbima_classification: string | null
  open_ended: boolean | null
  exclusive: boolean | null
  target_investors: string | null
  long_term_taxation: boolean | null
  custodian_name: string | null
  auditor_name: string | null
  equity: number | null
  equity_date: string | null
  admin_fee: number | null
  performance_fee: number | null
  performance_benchmark: string | null
  minimum_investment: number | null
  conversion_days: number | null
  redemption_payment_days: number | null
  terms_date: string | null
  fund: FundRegistry | null
}

export interface FundRegistrySubclass {
  id: number
  fund_registry_class_id: number
  code: string
  name: string
  status: string | null
  target_investors: string | null
  pension: boolean | null
}

export interface FundShareSeriesAlias {
  id: number
  fund_share_series_id: number
  label: string
  valid_from: string | null
  valid_to: string | null
  confirmed_at: string | null
}

export interface FundShareSeries {
  id: number
  name: string
  aliases: FundShareSeriesAlias[]
}

export interface FundRegistryClassDetail {
  registry_class: FundRegistryClass
  subclasses: FundRegistrySubclass[]
  series: FundShareSeries[]
  registered_units: {
    asset_id: number
    fund_registry_subclass_id: number | null
    fund_share_series_id: number | null
  }[]
}

export interface FundSeriesCandidate {
  label: string
  shares: number | null
  share_value: number | null
  has_shares: boolean
}

export interface FundSeriesFiling {
  fund_registry_class_id: number
  applicable: boolean
  filing_date: string | null
  candidates: FundSeriesCandidate[]
  searched_from: string | null
  searched_to: string | null
  files_read: number
}

export interface RegisterFund {
  fund_registry_class_id: number
  asset_type_id: number
  fund_registry_subclass_id?: number | null
  series_id?: number | null
  series_label?: string | null
}

export interface SeriesAliasInput {
  label: string
  valid_from: string | null
  valid_to: string | null
}

export const searchFundRegistry = (search: string) =>
  api
    .get<FundRegistryClass[]>(FUND_REGISTRY_ROUTES.search, { params: { search, limit: 30 } })
    .then((response) => response.data)

export const fetchFundRegistryClass = (classId: number) =>
  api
    .get<FundRegistryClassDetail>(FUND_REGISTRY_ROUTES.class(classId))
    .then((response) => response.data)

export const fetchFundSeriesFiling = (classId: number) =>
  api
    .get<FundSeriesFiling>(FUND_REGISTRY_ROUTES.series(classId))
    .then((response) => response.data)

export const registerFund = (payload: RegisterFund) =>
  api.post<{ id: number }>(ASSET_ROUTES.registerFund, payload).then((response) => response.data)

export const selectFundSeries = (assetId: number, choice: Pick<RegisterFund, 'series_id' | 'series_label'>) =>
  api.put<{ id: number }>(ASSET_ROUTES.fundSeries(assetId), choice).then((response) => response.data)

export const confirmFundSeriesAliases = (assetId: number, aliases: SeriesAliasInput[]) =>
  api
    .put<FundShareSeriesAlias[]>(ASSET_ROUTES.fundSeriesAliases(assetId), { aliases })
    .then((response) => response.data)
