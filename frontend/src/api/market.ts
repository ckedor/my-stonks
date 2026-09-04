import type { CandleDataPoint } from '@/components/charts/CandleChart'
import { ASSET_ROUTES, CURRENCY_ROUTES, FII_ROUTES, INVESTMENT_FUND_ROUTES, MARKET_CATALOGUE_ROUTES, MARKET_DATA_SERIES_ROUTES, QUOTE_ROUTES, STOCK_ROUTES, USD_BRL_ROUTES, type MarketCatalogueKind } from '@/constants/routes'
import api from '@/lib/api'
import type { ReturnsEntry } from '@/types'

export type BenchmarksPayload = Record<string, ReturnsEntry[]>

export const fetchBenchmarks = (currency: 'BRL' | 'USD' = 'BRL'): Promise<BenchmarksPayload> =>
  api
    .get<BenchmarksPayload>(MARKET_DATA_SERIES_ROUTES.timeSeries, { params: { currency } })
    .then((r) => r.data)

// ---------------------------------------------------------------------------
// Market data inspection (admin)
// ---------------------------------------------------------------------------

export interface UsdBrlHistoryPoint {
  date: string
  /** BRL value of one USD. */
  usd_brl: string
  /** USD value of one BRL, precomputed at ingestion. */
  brl_usd: string
  source: string
}

export const fetchUsdBrlHistory = (startDate?: string): Promise<UsdBrlHistoryPoint[]> =>
  api
    .get<UsdBrlHistoryPoint[]>(USD_BRL_ROUTES.history, {
      params: { start_date: startDate },
    })
    .then((r) => r.data)

/** Um ativo do cadastro, como o seletor de ativos precisa dele.
 *
 *  Não existe rota de busca no servidor: a lista inteira é servida de cache e
 *  quem filtra é a tela. Um seletor que busca por texto e por tipo trabalha em
 *  cima disto. */
export interface CatalogueAsset {
  id: number
  ticker: string
  name: string
  asset_type_id: number
  asset_type: { id: number; short_name: string; name: string }
}

export const fetchAssetCatalogue = (): Promise<CatalogueAsset[]> =>
  api.get<CatalogueAsset[]>(ASSET_ROUTES.list).then((r) => r.data)

export interface MarketDataSeriesOption {
  id: number
  short_name: string
  name: string
  symbol: string
}

export const fetchMarketDataSeriesOptions = (): Promise<MarketDataSeriesOption[]> =>
  api.get<MarketDataSeriesOption[]>(MARKET_DATA_SERIES_ROUTES.options).then((r) => r.data)

export interface MarketDataSeriesHistoryPoint {
  date: string
  close: number | null
  open: number | null
  high: number | null
  low: number | null
  source: string | null
}

export const fetchMarketDataSeriesHistory = (
  seriesId: number,
  startDate?: string,
): Promise<MarketDataSeriesHistoryPoint[]> =>
  api
    .get<MarketDataSeriesHistoryPoint[]>(MARKET_DATA_SERIES_ROUTES.history(seriesId), {
      params: { start_date: startDate },
    })
    .then((r) => r.data)

export interface Currency {
  id: number
  code: string
  name: string
}

export const fetchCurrencies = (): Promise<Currency[]> =>
  api.get<Currency[]>(CURRENCY_ROUTES.list).then((r) => r.data)

export interface PersistedQuote {
  date: string
  close: number | null
  open: number | null
  high: number | null
  low: number | null
  adjusted_close: number | null
  volume: number | null
  currency_id: number | null
  source: string | null
}

export interface PersistedQuotesEntry {
  asset_id: number
  ticker: string
  asset_type_id: number
  quotes: PersistedQuote[]
}

export const fetchPersistedQuotes = (
  assetId: number,
  startDate?: string,
): Promise<PersistedQuotesEntry[]> =>
  api
    .get<PersistedQuotesEntry[]>(QUOTE_ROUTES.persisted, {
      params: { asset_ids: [assetId], start_date: startDate },
    })
    .then((r) => r.data)

export interface QuotesResponse {
  ticker: string
  asset_type: string
  currency: string | null
  /** Provider-hosted brand image, absent for tickers without one. */
  logo_url: string | null
  quotes: {
    date: string
    open: number | null
    high: number | null
    low: number | null
    close: number
    adjusted_close: number | null
    volume: number | null
  }[]
}

/** Annualized growth over the whole served history.
 *
 * The window travels with the rate: the same percentage means very different
 * things over three years and over thirty. */
export interface HistoricalCagr {
  value: number
  start_date: string
  end_date: string
}

export interface AssetQuoteHistory extends QuotesResponse {
  /** Where the quotes came from: 'database' or 'provider'. */
  source: 'database' | 'provider'
  /** Absent when the history is too short to annualize honestly. */
  cagr: HistoricalCagr | null
}

/** History for one asset, served from storage when we have it.
 *
 * Prices come back in `currency`; the backend converts through the USD/BRL
 * history when the asset is not quoted in it, and reports which currency the
 * quotes ended up in. */
export const fetchAssetQuoteHistory = (
  assetId: number,
  startDate?: string,
  currency: string = 'BRL',
): Promise<AssetQuoteHistory> =>
  api
    .get<AssetQuoteHistory>(QUOTE_ROUTES.byAsset(assetId), {
      params: { start_date: startDate, currency },
    })
    .then((r) => r.data)

export const fetchOnDemandAssetQuotes = (
  ticker: string,
  assetTypeId: number,
  startDate?: string,
): Promise<QuotesResponse> =>
  api.get<QuotesResponse>(QUOTE_ROUTES.onDemand, {
    params: { ticker, asset_type_id: assetTypeId, start_date: startDate },
  }).then((r) => r.data)

export function quotesToCandleData(quotes: QuotesResponse['quotes']): CandleDataPoint[] {
  return quotes.map((q) => ({
    time: q.date.slice(0, 10),
    open: q.open ?? q.close,
    high: q.high ?? q.close,
    low: q.low ?? q.close,
    close: q.close,
    adjustedClose: q.adjusted_close ?? undefined,
    volume: q.volume ?? undefined,
  }))
}


// ---------------------------------------------------------------------------
// Real-estate fund profile
// ---------------------------------------------------------------------------

/** One payment per share made by a fund. Always BRL: these funds pay in reais
 *  and the backend does not restate them.
 *
 *  `event_type` is the fund's own label — an ordinary distribution
 *  (`RENDIMENTO`) or an amortization of capital. A reader that means income
 *  filters on it rather than summing the two. */
export interface FIIDividend {
  payment_date: string
  ex_date: string | null
  value_per_share: number
  event_type: string | null
}

/** What the fund reports about itself, as of its last published report.
 *
 *  Every field is optional: a provider that has never covered a fund, or that
 *  drops one indicator, must cost the card that one value and nothing else. An
 *  absent indicator is null, never zero — an unknown P/VP and a P/VP of zero
 *  are different statements.
 *
 *  The yields and the monthly return are ratios — 0.12381 is 12.381% — so it
 *  is the presentation that scales them. `price_to_nav` is the published P/VP,
 *  a multiple around 1. Monetary fields are in BRL. */
export interface FIIIndicators {
  as_of_date: string | null
  segment_type: string | null
  segment: string | null
  price: number | null
  nav_per_share: number | null
  price_to_nav: number | null
  dividend_yield_12m: number | null
  dividend_yield_1m: number | null
  monthly_return: number | null
  equity: number | null
  total_assets: number | null
  shares_outstanding: number | null
  shareholders: number | null
}

/** Who runs the fund and under which mandate. Published beside the indicators
 *  and kept apart from them: none of it is a measurement. */
export interface FIIManagement {
  cnpj: string | null
  mandate: string | null
  management_type: string | null
  administrator_name: string | null
  administrator_website: string | null
}

/** The monthly filing: what the fund's equity is made of, in reais.
 *
 *  The rates are ratios like everywhere else here, and the monetary fields are
 *  absolute amounts — not per share. */
export interface FIIMonthlyReport {
  reference_date: string | null
  admin_fee_rate: number | null
  monthly_patrimonial_return: number | null
  amortization_rate: number | null
  equity: number | null
  total_assets: number | null
  total_invested: number | null
  cash: number | null
  liquidity_needs: number | null
  government_bonds: number | null
  private_bonds: number | null
  fixed_income_funds: number | null
  real_estate: number | null
  real_estate_company_shares: number | null
  real_estate_company_units: number | null
  cri: number | null
  lci: number | null
  fii_holdings: number | null
  receivables: number | null
  rental_receivables: number | null
  other_receivables: number | null
  distributions_payable: number | null
  admin_fees_payable: number | null
  real_estate_obligations: number | null
  total_liabilities: number | null
}

/** The fund's buildings added up, as of one quarter.
 *
 *  `vacancy_rate` is consolidated and `average_vacancy_rate` is the plain
 *  average across buildings: one empty warehouse among thirty moves the second
 *  far more than the first. Areas are square metres. */
export interface FIIPropertySummary {
  count: number | null
  total_area: number | null
  vacancy_rate: number | null
  average_vacancy_rate: number | null
  properties_with_vacancy: number | null
}

/** One building, as the fund described it in the quarterly filing.
 *
 *  The construction and sale fields are filled only by funds still building or
 *  selling what they built; a finished income property leaves them null. */
export interface FIIProperty {
  name: string | null
  identifier: string | null
  address: string | null
  property_class: string | null
  area: number | null
  unit_count: number | null
  vacancy_rate: number | null
  delinquency_rate: number | null
  revenue_share: number | null
  leased_rate: number | null
  sold_rate: number | null
  construction_progress_actual: number | null
  construction_progress_expected: number | null
  construction_cost_actual: number | null
  construction_cost_expected: number | null
  invested_share: number | null
  confidential: boolean | null
}

/** One financial asset the fund holds: a CRI, a share in another fund. */
export interface FIIHolding {
  asset_class: string | null
  name: string | null
  issuer: string | null
  issuer_cnpj: string | null
  identifier: string | null
  quantity: number | null
  value: number | null
  issue: string | null
  series: string | null
  ticker: string | null
  maturity_date: string | null
  confidential: boolean | null
}

export interface FIILand {
  name: string | null
  identifier: string | null
  address: string | null
  area: number | null
  invested_share: number | null
  equity_share: number | null
  confidential: boolean | null
}

export interface FIIRight {
  name: string | null
  identifier: string | null
  value: number | null
  description: string | null
  confidential: boolean | null
}

/** How much of one asset class the fund held.
 *
 *  `value` is absent for the buildings: the quarterly filing counts and
 *  describes them, but declares no price for them. */
export interface FIIAllocation {
  asset_class: string
  count: number | null
  value: number | null
}

export interface FIICompositionSummary {
  total_items: number | null
  declared_value: number | null
  properties: FIIPropertySummary | null
  financial_assets_count: number | null
  financial_assets_value: number | null
  lands_count: number | null
  lands_area: number | null
  rights_count: number | null
  rights_value: number | null
}

/** What the fund held at the end of the last quarter it filed for.
 *
 *  Filed quarterly and published months later, so `reference_date` is not
 *  decoration: this is the most recent picture available, not the current one. */
export interface FIIComposition {
  reference_date: string | null
  summary: FIICompositionSummary | null
  allocations: FIIAllocation[]
  properties: FIIProperty[]
  financial_assets: FIIHolding[]
  fund_holdings: FIIHolding[]
  lands: FIILand[]
  rights: FIIRight[]
}

export interface FIICompositionPoint {
  reference_date: string | null
  summary: FIICompositionSummary | null
  allocations: FIIAllocation[]
}

export interface FIIPropertiesPoint {
  reference_date: string | null
  summary: FIIPropertySummary | null
}

/** Everything the fund publishes about itself.
 *
 *  Every section is independent: the backend reads each from a route of its
 *  own and one of them failing costs the page that section, not the profile.
 *  The monthly sections and the quarterly ones also carry different dates,
 *  which is why each states its own. */
export interface FIIProfile {
  ticker: string
  management: FIIManagement | null
  indicators: FIIIndicators | null
  indicators_history: FIIIndicators[]
  dividends: FIIDividend[]
  monthly_report: FIIMonthlyReport | null
  composition: FIIComposition | null
  composition_history: FIICompositionPoint[]
  properties_history: FIIPropertiesPoint[]
}

export const fetchFIIProfile = (assetId: number): Promise<FIIProfile> =>
  api.get<FIIProfile>(FII_ROUTES.profile(assetId)).then((r) => r.data)

export interface FIIMarketFund {
  asset_id: number | null
  ticker: string
  name: string
  cnpj: string | null
  type: string | null
  segment: string | null
  mandate: string | null
  management_type: string | null
  administrator: string | null
  price: number | null
  nav_per_share: number | null
  price_to_nav: number | null
  dividend_yield_12m: number | null
  investors: number | null
}

export interface FIIMarket {
  funds: FIIMarketFund[]
  total: number
  source: string
}

export const fetchFIIMarket = (): Promise<FIIMarket> =>
  api.get<FIIMarket>(FII_ROUTES.market).then((r) => r.data)


// ---------------------------------------------------------------------------
// Investment-fund profile
//
// Um fundo de investimento aqui é o que não é FII nem ETF: FIAGRO, FI-Infra,
// FIDC, FIP e FIF. Um FII publica prédios e vacância e tem perfil próprio; um
// ETF se lê como qualquer ativo listado.
// ---------------------------------------------------------------------------

/** O que o fundo é, no papel: cadastro e quem o administra.
 *
 *  `kind` é a família a que ele pertence — `fiagro`, `fidc`, `fiinfra`, `fif`,
 *  `fip` — e decide o que o resto do perfil pode conter: um FIDC arquiva valor
 *  de cota mensal e nenhum diário, um FIP não arquiva nenhum dos dois.
 *
 *  As três classificações vêm de três órgãos que discordam de propósito, então
 *  nenhuma vale pelas outras. */
export interface InvestmentFundIdentity {
  cnpj: string | null
  legal_name: string | null
  kind: string | null
  isin: string | null
  cvm_class_type: string | null
  cvm_classification: string | null
  anbima_classification: string | null
  b3_classification: string | null
  administrator_name: string | null
  administrator_cnpj: string | null
  manager_name: string | null
  manager_cnpj: string | null
  status: string | null
}

/** Os números do fundo, na data do informe de onde vieram.
 *
 *  Os retornos e o yield são razões — 0,0142 é 1,42% — e `price_to_nav` é o
 *  P/VP publicado, um múltiplo em torno de 1: abaixo dele a cota negocia por
 *  menos do que o fundo diz valer. Nada é escalado aqui.
 *
 *  `daily_applications` e `daily_redemptions` são o dinheiro que entrou e saiu
 *  no dia de referência, em reais. Um fundo fechado arquiva zero nos dois
 *  porque ninguém pode aplicar nem resgatar — o que é um fato sobre o fundo, e
 *  não uma lacuna no dado.
 *
 *  Todo campo é opcional: o provedor deixa a maioria em branco para a maioria
 *  dos tipos de fundo, e ausente é `null` e nunca zero. */
export interface InvestmentFundIndicators {
  as_of_date: string | null
  price: number | null
  nav_per_share: number | null
  price_to_nav: number | null
  equity: number | null
  total_assets: number | null
  shareholders: number | null
  daily_applications: number | null
  daily_redemptions: number | null
  shares_outstanding: number | null
  monthly_return: number | null
  patrimonial_monthly_return: number | null
  dividend_yield_monthly: number | null
}

/** Um arquivamento do valor da cota, com o patrimônio por trás dele.
 *
 *  É a contabilidade do fundo, não o preço de mercado: uma cota que não negocia
 *  há uma semana continua tendo valor patrimonial arquivado todo dia. Um FIDC
 *  arquiva por classe ou série, então `class_or_series` faz parte do que
 *  identifica uma linha. */
export interface InvestmentFundNavPoint {
  date: string
  class_or_series: string | null
  nav_per_share: number | null
  equity: number | null
  total_assets: number | null
  shareholders: number | null
  daily_applications: number | null
  daily_redemptions: number | null
  monthly_return: number | null
}

/** Um pagamento por cota, como publicado. Sempre em reais.
 *
 *  `event_type` é o rótulo do próprio fundo — distribuição comum ou amortização
 *  de capital. Quem quer dizer renda filtra por ele em vez de somar os dois.
 *
 *  O provedor não estima data de pagamento por intervalo fixo, já que fundos
 *  desses tipos não têm um: nenhuma periodicidade se lê da série. */
export interface InvestmentFundDividend {
  payment_date: string
  ex_date: string | null
  declared_date: string | null
  value_per_share: number
  event_type: string | null
}

/** Quem detém o fundo, no informe mensal.
 *
 *  Contagem e participação vêm as duas: um fundo alimentado por outro é um
 *  cotista e o patrimônio inteiro, e cada número sozinho conta metade disso. */
export interface InvestmentFundInvestorBreakdown {
  individual_retail: number | null
  individual_retail_percent: number | null
  legal_entities: number | null
  legal_entities_percent: number | null
  funds_or_clubs: number | null
  funds_or_clubs_percent: number | null
  non_residents: number | null
  non_residents_percent: number | null
  other: number | null
  other_percent: number | null
}

/** Como o fundo mede o próprio risco, no informe mensal.
 *
 *  `risk_model` é o que torna os números ao lado comparáveis ou não: um VaR de
 *  modelo não-paramétrico e um de modelo paramétrico não são a mesma grandeza,
 *  então o modelo viaja com eles. */
export interface InvestmentFundRisk {
  risk_model: string | null
  portfolio_var: number | null
  daily_quota_variation_percent: number | null
  stressed_daily_quota_variation_percent: number | null
  private_credit_exposure_percent: number | null
}

/** O informe mensal que o administrador entrega ao regulador.
 *
 *  Só os fundos de quem o regulador exige entregam um, então a ausência é um
 *  fato sobre o tipo do fundo e não uma falha de leitura. */
export interface InvestmentFundRegulatoryProfile {
  reference_date: string | null
  investors: InvestmentFundInvestorBreakdown | null
  risk: InvestmentFundRisk | null
  top_investor_percent: number | null
  private_credit_exposure_percent: number | null
}

/** Uma linha do informe trimestral da carteira.
 *
 *  `bucket` diz de que grupo a linha veio. Os dois últimos — `receivables` e
 *  `payables` — são direitos e obrigações, não coisas possuídas, e é por isso
 *  que o grupo anda junto da linha: somadas às cegas, uma conta a pagar
 *  inflaria o que o fundo tem.
 *
 *  `details` é o que mais o informe disse daquela linha. As chaves variam por
 *  grupo e por fundo, então vêm como arquivadas. */
export interface InvestmentFundHolding {
  bucket: string
  asset_type: string | null
  asset_name: string | null
  issuer_name: string | null
  issuer_cnpj: string | null
  isin: string | null
  selic_code: string | null
  quantity: number | null
  market_value: number | null
  cost_value: number | null
  maturity_date: string | null
  confidential: boolean | null
  details: Record<string, unknown>
}

/** O informe trimestral somado, por grupo.
 *
 *  `market_value` é o total do próprio informe e não é a soma dos seis grupos
 *  abaixo dele: os recebíveis somam e as obrigações subtraem. */
export interface InvestmentFundPortfolioSummary {
  market_value: number | null
  holdings_count: number | null
  public_bonds_value: number | null
  fund_holdings_value: number | null
  credit_assets_value: number | null
  listed_securities_value: number | null
  receivables_value: number | null
  payables_value: number | null
}

/** O que o fundo tinha no fim do último trimestre que arquivou.
 *
 *  Arquivado trimestralmente e publicado meses depois, então `reference_date`
 *  não é enfeite: é o retrato mais recente disponível, não o de hoje. */
export interface InvestmentFundPortfolio {
  reference_date: string | null
  summary: InvestmentFundPortfolioSummary | null
  holdings: InvestmentFundHolding[]
}

/** Tudo o que o fundo publica sobre si mesmo.
 *
 *  Cada seção é independente: o backend lê cada uma de uma rota própria e uma
 *  falhando custa à página aquela seção, não o perfil. As seções também chegam
 *  em relógios diferentes — o valor da cota diário ou mensal, o informe do
 *  regulador mensal, a carteira trimestral e com meses de atraso —, e é por
 *  isso que cada uma declara a própria data. */
export interface InvestmentFundProfile {
  ticker: string
  identity: InvestmentFundIdentity | null
  indicators: InvestmentFundIndicators | null
  nav_history: InvestmentFundNavPoint[]
  dividends: InvestmentFundDividend[]
  regulatory_profile: InvestmentFundRegulatoryProfile | null
  portfolio: InvestmentFundPortfolio | null
}

export const fetchInvestmentFundProfile = (assetId: number): Promise<InvestmentFundProfile> =>
  api.get<InvestmentFundProfile>(INVESTMENT_FUND_ROUTES.profile(assetId)).then((r) => r.data)

/** Um fundo do catálogo, resumido.
 *
 *  `asset_id` só vem preenchido para fundos registrados na aplicação, e é ele
 *  que faz uma linha abrir uma página — o resto do catálogo se lê, mas não tem
 *  o que abrir. */
export interface InvestmentFundMarketFund {
  asset_id: number | null
  ticker: string
  name: string
  cnpj: string | null
  kind: string | null
  b3_classification: string | null
  anbima_classification: string | null
  administrator: string | null
  manager: string | null
  price: number | null
  nav_per_share: number | null
  price_to_nav: number | null
  equity: number | null
  total_assets: number | null
  investors: number | null
}

export interface InvestmentFundMarket {
  funds: InvestmentFundMarketFund[]
  total: number
  source: string
}

export const fetchInvestmentFundMarket = (): Promise<InvestmentFundMarket> =>
  api.get<InvestmentFundMarket>(INVESTMENT_FUND_ROUTES.market).then((r) => r.data)

// ---------------------------------------------------------------------------
// Stock profile
//
// Uma ação não é um fundo. O que um fundo publica de si é valor de cota e
// carteira; o que uma companhia publica é resultado, balanço e caixa — e o
// mercado precifica isso num múltiplo. As duas metades vêm juntas porque a
// leitura que a tela faz é a delas duas: caro ou barato contra o quanto o
// negócio é bom.
//
// Toda proporção aqui é razão: 0,08 é 8%. O provedor manda a variação do dia
// em ponto percentual e as margens em fração, e a divisão acontece no backend
// para que nada aqui precise lembrar de qual rota o número veio.
// ---------------------------------------------------------------------------

/** O negócio por trás do ticker.
 *
 *  A classificação vem duas vezes de propósito: `sector` e `industry` são de
 *  leitura, `sector_key` e `industry_key` são slugs estáveis e é neles que se
 *  agrupa — um rótulo é reescrito, um slug não.
 *
 *  O bloco de administradora que o provedor carrega para fundos não existe
 *  aqui: numa companhia ele vem inteiro nulo, e catorze linhas vazias são
 *  piores do que seção nenhuma. */
export interface StockCompany {
  name: string | null
  sector: string | null
  sector_key: string | null
  industry: string | null
  industry_key: string | null
  website: string | null
  city: string | null
  state: string | null
  country: string | null
  employees: number | null
  cnpj: string | null
  founded_on: string | null
  logo_url: string | null
  /** Os parágrafos que a companhia escreveu, já separados. */
  summary_paragraphs: string[]
}

/** A cotação e a faixa que o ano desenhou em volta dela.
 *
 *  Um preço sozinho não diz se está alto: o mesmo número é teto para uma
 *  companhia e piso para outra. `day_change` é razão como todo o resto. */
export interface StockPriceRange {
  price: number | null
  previous_close: number | null
  day_change: number | null
  day_low: number | null
  day_high: number | null
  fifty_two_week_low: number | null
  fifty_two_week_high: number | null
  market_cap: number | null
  volume: number | null
  as_of: string | null
}

/** O que o mercado paga pela companhia.
 *
 *  Os múltiplos vêm como o provedor os publica e nunca são recalculados a
 *  partir de preço e lucro: recalcular produziria um terceiro número que
 *  discorda dos dois já na tela. */
export interface StockStatistics {
  market_cap: number | null
  enterprise_value: number | null
  trailing_pe: number | null
  forward_pe: number | null
  price_to_book: number | null
  book_value_per_share: number | null
  earnings_per_share: number | null
  forward_earnings_per_share: number | null
  peg_ratio: number | null
  beta: number | null
  dividend_yield: number | null
  profit_margin: number | null
  net_income: number | null
  earnings_quarterly_growth: number | null
  enterprise_to_revenue: number | null
  enterprise_to_ebitda: number | null
  shares_outstanding: number | null
  float_shares: number | null
  fifty_two_week_change: number | null
  most_recent_quarter: string | null
  last_dividend_value: number | null
  last_dividend_date: string | null
}

/** Como o negócio foi, antes de o mercado ter opinião.
 *
 *  `earnings_growth` e `revenue_growth` comparam um trimestre com o mesmo
 *  trimestre do ano anterior; o par `annual_` compara anos. Os números são
 *  bem diferentes, e a tela tem de dizer qual está mostrando. */
export interface StockFundamentals {
  revenue: number | null
  gross_profit: number | null
  ebitda: number | null
  total_cash: number | null
  cash_per_share: number | null
  total_debt: number | null
  debt_to_equity: number | null
  current_ratio: number | null
  quick_ratio: number | null
  return_on_assets: number | null
  return_on_equity: number | null
  free_cash_flow: number | null
  operating_cash_flow: number | null
  gross_margin: number | null
  ebitda_margin: number | null
  operating_margin: number | null
  profit_margin: number | null
  earnings_growth: number | null
  revenue_growth: number | null
  annual_earnings_growth: number | null
  annual_revenue_growth: number | null
}

/** Um pagamento em dinheiro, por ação.
 *
 *  `label` separa dividendo de JCP, e os dois não são intercambiáveis: o
 *  segundo tem retenção na fonte, então quem soma renda recebida precisa saber
 *  qual é qual. `last_date_prior` é o último dia com direito; a data ex é o
 *  pregão seguinte. `payment_date` no futuro é normal — a companhia anuncia
 *  com meses de antecedência. */
export interface StockCashDividend {
  payment_date: string | null
  last_date_prior: string | null
  approved_on: string | null
  value_per_share: number | null
  label: string | null
  related_to: string | null
}

/** Um pagamento em ações: bonificação ou desdobramento.
 *
 *  Tem proporção e não tem valor, e nunca teve data de pagamento — é por isso
 *  que é uma forma própria, e não um dividendo com metade dos campos vazios. */
export interface StockShareDividend {
  factor: number | null
  complete_factor: string | null
  last_date_prior: string | null
  approved_on: string | null
  label: string | null
}

/** Um direito de subscrever ações novas, que não é nenhum dos outros dois. */
export interface StockSubscription {
  factor: number | null
  complete_factor: string | null
  price: number | null
  last_date_prior: string | null
  approved_on: string | null
  label: string | null
}

/** Um período de um demonstrativo, com só as linhas que a companhia arquivou.
 *
 *  `lines` é um mapa e não campos porque os arquivantes discordam sobre quais
 *  linhas existem: a rota devolve toda linha que qualquer companhia brasileira
 *  poderia reportar — 128 no balanço — e um banco preenche 31 delas enquanto
 *  uma petroleira preenche 65, com 16 em comum. Declaradas como campos, três
 *  quartos do tipo seriam nulos para qualquer companhia.
 *
 *  As chaves são os nomes de linha em snake_case, e uma linha que a companhia
 *  não arquivou está ausente — nunca zero. Quais delas viram tela, e em que
 *  ordem, é o que `labels.ts` decide. */
export interface StockStatementPoint {
  end_date: string | null
  /** O que o arquivante chamou o período: `quarterly`, `yearly`. */
  period: string | null
  lines: Record<string, number>
}

/** Tudo o que uma companhia listada publica sobre si, numa leitura só.
 *
 *  Cada seção vem de uma rota própria e qualquer uma pode faltar: uma rota que
 *  falha custa à página aquela seção, e não a página. As séries vêm da mais
 *  antiga para a mais recente.
 *
 *  `ticker` é o que se pediu e `resolved_ticker` é como o mercado chama hoje;
 *  `renamed` diz que os dois diferem, para que quem cai numa página sob um
 *  código que não reconhece seja avisado em vez de ficar em dúvida. */
export interface StockProfile {
  ticker: string
  resolved_ticker: string | null
  renamed: boolean
  company: StockCompany | null
  price_range: StockPriceRange | null
  statistics: StockStatistics | null
  fundamentals: StockFundamentals | null
  cash_dividends: StockCashDividend[]
  share_dividends: StockShareDividend[]
  subscriptions: StockSubscription[]
  income_statement: StockStatementPoint[]
  balance_sheet: StockStatementPoint[]
  cash_flow: StockStatementPoint[]
  value_added: StockStatementPoint[]
}

export const fetchStockProfile = (assetId: number): Promise<StockProfile> =>
  api.get<StockProfile>(STOCK_ROUTES.profile(assetId)).then((r) => r.data)

// ---------------------------------------------------------------------------
// Market catalogues
// ---------------------------------------------------------------------------

export type { MarketCatalogueKind } from '@/constants/routes'

export interface MarketCatalogueAsset {
  asset_id: number | null
  ticker: string
  name: string
  price: number | null
  change_percent: number | null
  volume: number | null
  market_cap: number | null
  currency: string
  logo_url: string | null
}

export interface MarketCatalogue {
  assets: MarketCatalogueAsset[]
  total: number
  source: string
}

export const fetchMarketCatalogue = (kind: MarketCatalogueKind): Promise<MarketCatalogue> =>
  api.get<MarketCatalogue>(MARKET_CATALOGUE_ROUTES.byKind(kind)).then((r) => r.data)

// ---------------------------------------------------------------------------
// Asset registry sync
// ---------------------------------------------------------------------------

/** Um ativo que o catálogo corrige, com o antes e o depois de cada campo. */
export interface AssetSyncChange {
  kind: string
  ticker: string
  changes: Record<string, [string | null, string | null]>
}

export interface AssetSyncEntry {
  kind: string
  ticker: string | null
  name: string
}

export interface AssetSyncReport {
  dry_run: boolean
  kinds: string[]
  created: AssetSyncEntry[]
  updated: AssetSyncChange[]
  unchanged: number
  kept_local: AssetSyncEntry[]
}

/** Casa o cadastro de ativos com o catálogo do provedor.
 *
 *  `dryRun` é o padrão da rota e o padrão daqui: a chamada devolve o relatório
 *  do que mudaria sem escrever nada. */
export const syncAssetCatalogue = (
  kinds: string[] | undefined,
  dryRun: boolean,
): Promise<AssetSyncReport> =>
  api
    .post<AssetSyncReport>(ASSET_ROUTES.sync, null, {
      params: { kinds, dry_run: dryRun },
      paramsSerializer: { indexes: null },
    })
    .then((r) => r.data)

export interface MarketAssetDetails {
  id: number
  ticker: string | null
  name: string
  logo_url?: string | null
  asset_type_id: number
  asset_type: {
    id: number
    short_name: string
    name: string
    asset_class_id: number
  }
}

export const fetchMarketAssetDetails = (assetId: number): Promise<MarketAssetDetails> =>
  api.get<MarketAssetDetails>(ASSET_ROUTES.byId(assetId)).then((r) => r.data)


// ---------------------------------------------------------------------------
// Favourites, ranked by how often the user opens an asset
// ---------------------------------------------------------------------------

export interface FavoriteAsset {
  id: number
  ticker: string | null
  name: string
  asset_type_id: number
  logo_url: string | null
  asset_type: { id: number; short_name: string; name: string }
  visit_count: number
  last_visited_at: string | null
}

export const fetchFavoriteAssets = (
  limit = 8,
  assetTypeId?: number,
  assetIds?: number[],
  brazilian?: boolean,
): Promise<FavoriteAsset[]> =>
  api
    .get<FavoriteAsset[]>(ASSET_ROUTES.favorites, {
      params: {
        limit,
        asset_type_id: assetTypeId,
        asset_ids: assetIds,
        brazilian,
      },
    })
    .then((r) => r.data)

/** Counts one visit. Always resolves: a lost visit count must never break the
 *  page. Awaited only to reorder the ranking after the backend has taken it. */
export const recordAssetVisit = (assetId: number): Promise<void> =>
  api
    .post(ASSET_ROUTES.visit(assetId))
    .then(() => undefined)
    .catch(() => undefined)
