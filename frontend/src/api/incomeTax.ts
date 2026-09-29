import { INCOME_TAX_ROUTES } from '@/constants/routes'
import api from '@/lib/api'

/* Imposto de renda: a apuração do ano e os DARFs pagos.
 *
 * A apuração é do usuário, sobre todas as carteiras dele — o limite de isenção
 * e o prejuízo a compensar são do CPF, não de uma carteira. Dinheiro chega como
 * texto com duas casas ("1500.00"): o backend calcula em decimal e não passa
 * por float; a tela converte só para escrever. */

/** Valor monetário exato, como o backend o envia. */
export type Money = string

export type TaxRegime = 'common' | 'real_estate_fund' | 'crypto'

type TaxAssetKind =
  | 'stock'
  | 'equity_etf'
  | 'fixed_income_etf'
  | 'bdr'
  | 'real_estate_fund'
  | 'crypto'
  | 'out_of_scope'

export type DarfStatus = 'below_minimum' | 'paid' | 'partially_paid' | 'open' | 'overdue'

export interface MonthlyAssessment {
  /** Primeiro dia do mês (YYYY-MM-DD). */
  month: string
  /** Sem regra para o período, o mês não foi apurado. */
  covered: boolean
  sales: Money
  /** As vendas que contam para o limite de isenção: ações, ou cripto. */
  exemption_sales: Money
  within_exemption: boolean
  result: Money
  exempt_gain: Money
  loss_carried_in: Money
  loss_used: Money
  loss_carried_out: Money
  taxable_base: Money
  tax_due: Money
  withheld_in_month: Money
  withheld_carried_in: Money
  withheld_used: Money
  withheld_carried_out: Money
  tax_payable: Money
}

export interface RegimeAssessment {
  regime: TaxRegime
  /** Nula nas faixas progressivas (cripto). */
  rate: string | null
  revenue_code: string | null
  monthly_sales_exemption: Money | null
  carries_losses: boolean | null
  source: string | null
  months: MonthlyAssessment[]
  loss_to_carry: Money
  withheld_to_declare: Money
}

export interface RealizedSale {
  transaction_id: number
  portfolio_id: number
  asset_id: number
  ticker: string
  kind: TaxAssetKind
  /** Nulo para o que fica fora do DARF: ETF de renda fixa. */
  regime: TaxRegime | null
  broker_id: number
  day: string
  quantity: string
  gross_value: Money
  fees: Money
  cost: Money
  result: Money
  withheld_income_tax: Money
  fees_informed: boolean
}

export interface DarfPayment {
  id: number
  revenue_code: string
  period: string
  paid_on: string
  principal: Money
  fine: Money
  interest: Money
}

export interface DarfObligation {
  revenue_code: string
  period: string
  due_date: string
  by_regime: { regime: TaxRegime; amount: Money }[]
  carried_in: Money
  amount: Money
  carried_out: Money
  paid_principal: Money
  balance: Money
  status: DarfStatus
  payments: DarfPayment[]
}

export interface TaxPendency {
  code: string
  message: string
  day: string | null
  asset_id: number | null
  ticker: string | null
  transaction_ids: number[]
}

export interface IncomeTaxAssessment {
  fiscal_year: number
  filing_year: number
  darf_minimum: Money
  regimes: RegimeAssessment[]
  sales: RealizedSale[]
  obligations: DarfObligation[]
  pendencies: TaxPendency[]
}

export interface DarfPaymentInput {
  revenue_code: string
  /** Qualquer dia do mês de apuração; o backend guarda o primeiro. */
  period: string
  paid_on: string
  principal: string
  fine: string
  interest: string
}

/** Uma linha do informe de bens e direitos, por carteira. */
export interface AssetTaxInfo {
  grupo: string
  codigo: string
  discriminacao: string
  position_previous_year: number
  position_fiscal_year: number
  exempt_dividends: number
  codigo_negociacao: string
  negociado_em_bolsa: boolean
  locale: string
  cnpj: string
}

export async function fetchIncomeTaxAssessment(fiscalYear: number): Promise<IncomeTaxAssessment> {
  const { data } = await api.get<IncomeTaxAssessment>(INCOME_TAX_ROUTES.assessment, {
    params: { fiscal_year: fiscalYear },
  })
  return data
}

export async function fetchAssetsAndRights(
  portfolioId: number,
  fiscalYear: number
): Promise<AssetTaxInfo[]> {
  const { data } = await api.get<AssetTaxInfo[]>(INCOME_TAX_ROUTES.assetsAndRights(portfolioId), {
    params: { fiscal_year: fiscalYear },
  })
  return data
}

export async function registerDarfPayment(payment: DarfPaymentInput): Promise<DarfPayment> {
  const { data } = await api.post<DarfPayment>(INCOME_TAX_ROUTES.darfPayments, payment)
  return data
}

export async function deleteDarfPayment(paymentId: number): Promise<void> {
  await api.delete(INCOME_TAX_ROUTES.darfPayment(paymentId))
}
