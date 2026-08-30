import type { StockStatementPoint } from '@/api/market'
import { formatCompactBRL } from '../format'
import type { PublishedSeriesMetric } from '../PublishedSeriesChart'

/** Quais linhas de um demonstrativo viram tela, e em que ordem.
 *
 *  O provedor devolve toda linha que qualquer arquivante brasileiro poderia
 *  reportar — 128 no balanço — e uma companhia preenche um terço delas. Quais
 *  aparecem não pode ser "as que vieram": a ordem de um `Object.keys` é a do
 *  provedor, não a de leitura, e um balanço que abre por `biological_assets` é
 *  ilegível mesmo estando completo.
 *
 *  Então a ordem está aqui, escrita, e é a de quem lê a peça: da receita ao
 *  lucro, do ativo ao patrimônio líquido, do caixa operacional ao saldo final.
 *  Uma linha que a companhia não arquivou some do grupo em vez de virar um
 *  traço, e um grupo que ficou sem linha nenhuma some inteiro.
 *
 *  Os dois conjuntos convivem de propósito. Um banco arquiva
 *  `financial_assets` e uma petroleira arquiva `inventory`, e nenhum dos dois
 *  arquiva o do outro: as duas listas estão aqui juntas, e cada companhia
 *  acende a sua. Foi o que o provedor mostrou quando Petrobras e Itaú
 *  responderam 65 e 31 linhas de balanço com 16 em comum.
 *
 *  Uma linha fora daqui continua no payload e não some do mundo — ela só não
 *  tem nome ainda. Dar nome a ela é acrescentar uma entrada, e não migrar
 *  nada.
 */

export interface StatementGroup {
  label: string
  /** As chaves do mapa `lines`, na ordem em que a peça se lê. */
  keys: string[]
}

export const INCOME_STATEMENT_GROUPS: StatementGroup[] = [
  {
    label: 'Da receita ao lucro bruto',
    keys: ['total_revenue', 'cost_of_revenue', 'gross_profit'],
  },
  {
    label: 'Operação',
    keys: [
      'selling_general_administrative',
      'sales_expenses',
      'other_operating_income',
      'other_operating_expenses',
      'total_operating_expenses',
      'operating_income',
      'ebit',
      'clean_ebitda',
    ],
  },
  {
    label: 'Resultado financeiro',
    keys: ['financial_income', 'financial_expenses', 'financial_result', 'equity_income_result'],
  },
  {
    label: 'Do resultado ao lucro líquido',
    keys: [
      'income_before_tax',
      'income_before_statutory_participations_and_contributions',
      'income_tax_expense',
      'current_taxes',
      'deferred_taxes',
      'net_income_from_continuing_ops',
      'discontinued_operations',
      'minority_interest',
      'net_income',
    ],
  },
  {
    label: 'Por ação',
    keys: [
      'basic_earnings_per_common_share',
      'basic_earnings_per_preferred_share',
      'diluted_earnings_per_common_share',
      'diluted_earnings_per_preferred_share',
    ],
  },
]

export const BALANCE_SHEET_GROUPS: StatementGroup[] = [
  {
    label: 'Ativo circulante',
    keys: [
      'cash',
      'short_term_investments',
      'net_receivables',
      'accounts_receivable_from_clients',
      'inventory',
      'taxes_to_recover',
      'other_current_assets',
      'total_current_assets',
    ],
  },
  {
    label: 'Ativo não circulante',
    keys: [
      'long_term_receivables',
      'long_term_investments',
      'investments',
      'investment_properties',
      'property_plant_equipment',
      'intangible_assets',
      'long_term_assets',
    ],
  },
  {
    // As linhas de instituição financeira. Uma companhia industrial não tem
    // nenhuma delas, e o grupo inteiro não aparece para ela.
    label: 'Ativo financeiro',
    keys: [
      'financial_assets',
      'central_bank_compulsory_deposit',
      'current_and_deferred_taxes',
      'other_assets',
    ],
  },
  {
    label: 'Passivo circulante',
    keys: [
      'providers',
      'national_suppliers',
      'foreign_suppliers',
      'loans_and_financing',
      'debentures',
      'lease_financing',
      'tax_obligations',
      'social_and_labor_obligations',
      'provisions',
      'other_current_liabilities',
      'current_liabilities',
    ],
  },
  {
    label: 'Passivo não circulante',
    keys: [
      'long_term_loans_and_financing',
      'long_term_debentures',
      'long_term_provisions',
      'long_term_deferred_taxes',
      'other_long_term_obligations',
      'non_current_liabilities',
      'financial_liabilities_at_amortized_cost',
      'tax_liabilities',
      'other_liabilities',
    ],
  },
  {
    label: 'Patrimônio líquido',
    keys: [
      'realized_share_capital',
      'capital_reserves',
      'profit_reserves',
      'retained_earnings',
      'accumulated_profits_or_losses',
      'equity_valuation_adjustments',
      'cumulative_conversion_adjustments',
      'other_comprehensive_results',
      'minority_interest',
      'non_controlling_shareholders_equity',
      'shareholders_equity',
    ],
  },
  {
    label: 'Totais',
    keys: ['total_assets', 'total_liab'],
  },
]

export const CASH_FLOW_GROUPS: StatementGroup[] = [
  {
    label: 'Operação',
    keys: [
      'income_from_operations',
      'net_income_before_taxes',
      'adjustments_to_profit_or_loss',
      'changes_in_assets_and_liabilities',
      'other_operating_activities',
      'operating_cash_flow',
    ],
  },
  {
    label: 'Investimento e financiamento',
    keys: ['investment_cash_flow', 'financing_cash_flow', 'free_cash_flow'],
  },
  {
    label: 'Saldo de caixa',
    keys: [
      'initial_cash_balance',
      'increase_or_decrease_in_cash',
      'foreign_exchange_rate_without_cash',
      'exchange_variation_without_cash',
      'final_cash_balance',
    ],
  },
]

export const VALUE_ADDED_GROUPS: StatementGroup[] = [
  {
    label: 'Riqueza gerada',
    keys: [
      'revenue',
      'product_sales',
      'revenue_from_the_provision_of_services',
      'other_revenues',
      'supplies_purchased_from_third_parties',
      'gross_added_value',
      'depreciation_and_amortization',
      'net_added_value',
      'added_value_received_on_transfer',
      'added_value_to_distribute',
    ],
  },
  {
    label: 'Para quem ela foi',
    keys: [
      'team_remuneration',
      'taxes',
      'federal_taxes',
      'state_taxes',
      'municipal_taxes',
      'remuneration_of_third_party_capitals',
      'own_equity_remuneration',
      'dividends',
      'interest_on_own_equity',
      'retained_earnings_or_loss',
      'non_controlling_share_of_retained_earnings',
      'distribution_of_added_value',
    ],
  },
]

/** Como cada linha se chama em português.
 *
 *  Um único mapa para os quatro demonstrativos: uma linha com o mesmo nome
 *  técnico é a mesma linha, e `equity_income_result` não pode ser "equivalência
 *  patrimonial" na DRE e outra coisa na DVA.
 */
export const STATEMENT_LINE_LABELS: Record<string, string> = {
  // Resultado
  total_revenue: 'Receita total',
  cost_of_revenue: 'Custo da receita',
  gross_profit: 'Lucro bruto',
  selling_general_administrative: 'Despesas gerais e administrativas',
  sales_expenses: 'Despesas com vendas',
  other_operating_income: 'Outras receitas operacionais',
  other_operating_expenses: 'Outras despesas operacionais',
  total_operating_expenses: 'Despesas operacionais',
  operating_income: 'Resultado operacional',
  ebit: 'EBIT',
  clean_ebitda: 'EBITDA',
  financial_income: 'Receitas financeiras',
  financial_expenses: 'Despesas financeiras',
  financial_result: 'Resultado financeiro',
  equity_income_result: 'Equivalência patrimonial',
  income_before_tax: 'Resultado antes dos impostos',
  income_before_statutory_participations_and_contributions:
    'Resultado antes de participações estatutárias',
  income_tax_expense: 'Imposto de renda e contribuição social',
  current_taxes: 'Impostos correntes',
  deferred_taxes: 'Impostos diferidos',
  net_income_from_continuing_ops: 'Resultado das operações continuadas',
  discontinued_operations: 'Operações descontinuadas',
  minority_interest: 'Participação de não controladores',
  net_income: 'Lucro líquido',
  basic_earnings_per_common_share: 'LPA básico — ON',
  basic_earnings_per_preferred_share: 'LPA básico — PN',
  diluted_earnings_per_common_share: 'LPA diluído — ON',
  diluted_earnings_per_preferred_share: 'LPA diluído — PN',

  // Balanço
  cash: 'Caixa e equivalentes',
  short_term_investments: 'Aplicações financeiras',
  net_receivables: 'Contas a receber',
  accounts_receivable_from_clients: 'Contas a receber de clientes',
  inventory: 'Estoques',
  taxes_to_recover: 'Tributos a recuperar',
  other_current_assets: 'Outros ativos circulantes',
  total_current_assets: 'Ativo circulante',
  long_term_receivables: 'Realizável a longo prazo',
  long_term_investments: 'Investimentos de longo prazo',
  investments: 'Investimentos',
  investment_properties: 'Propriedades para investimento',
  property_plant_equipment: 'Imobilizado',
  intangible_assets: 'Intangível',
  long_term_assets: 'Ativo não circulante',
  financial_assets: 'Ativos financeiros',
  central_bank_compulsory_deposit: 'Compulsório no Banco Central',
  current_and_deferred_taxes: 'Tributos correntes e diferidos',
  other_assets: 'Outros ativos',
  providers: 'Fornecedores',
  national_suppliers: 'Fornecedores nacionais',
  foreign_suppliers: 'Fornecedores estrangeiros',
  loans_and_financing: 'Empréstimos e financiamentos',
  debentures: 'Debêntures',
  lease_financing: 'Arrendamentos',
  tax_obligations: 'Obrigações fiscais',
  social_and_labor_obligations: 'Obrigações sociais e trabalhistas',
  provisions: 'Provisões',
  other_current_liabilities: 'Outros passivos circulantes',
  current_liabilities: 'Passivo circulante',
  long_term_loans_and_financing: 'Empréstimos de longo prazo',
  long_term_debentures: 'Debêntures de longo prazo',
  long_term_provisions: 'Provisões de longo prazo',
  long_term_deferred_taxes: 'Tributos diferidos',
  other_long_term_obligations: 'Outras obrigações de longo prazo',
  non_current_liabilities: 'Passivo não circulante',
  financial_liabilities_at_amortized_cost: 'Passivos financeiros ao custo amortizado',
  tax_liabilities: 'Obrigações tributárias',
  other_liabilities: 'Outros passivos',
  realized_share_capital: 'Capital social realizado',
  capital_reserves: 'Reservas de capital',
  profit_reserves: 'Reservas de lucro',
  retained_earnings: 'Lucros acumulados',
  accumulated_profits_or_losses: 'Lucros ou prejuízos acumulados',
  equity_valuation_adjustments: 'Ajustes de avaliação patrimonial',
  cumulative_conversion_adjustments: 'Ajustes acumulados de conversão',
  other_comprehensive_results: 'Outros resultados abrangentes',
  non_controlling_shareholders_equity: 'Patrimônio de não controladores',
  shareholders_equity: 'Patrimônio líquido',
  total_assets: 'Ativo total',
  total_liab: 'Passivo total',

  // Caixa
  income_from_operations: 'Resultado das operações',
  net_income_before_taxes: 'Resultado antes dos impostos',
  adjustments_to_profit_or_loss: 'Ajustes ao resultado',
  changes_in_assets_and_liabilities: 'Variação de ativos e passivos',
  other_operating_activities: 'Outras atividades operacionais',
  operating_cash_flow: 'Caixa das operações',
  investment_cash_flow: 'Caixa de investimento',
  financing_cash_flow: 'Caixa de financiamento',
  free_cash_flow: 'Fluxo de caixa livre',
  initial_cash_balance: 'Saldo inicial de caixa',
  increase_or_decrease_in_cash: 'Variação do caixa',
  foreign_exchange_rate_without_cash: 'Variação cambial sem efeito caixa',
  exchange_variation_without_cash: 'Variação cambial sem efeito caixa',
  final_cash_balance: 'Saldo final de caixa',

  // Valor adicionado
  revenue: 'Receitas',
  product_sales: 'Venda de produtos',
  revenue_from_the_provision_of_services: 'Prestação de serviços',
  other_revenues: 'Outras receitas',
  supplies_purchased_from_third_parties: 'Insumos adquiridos de terceiros',
  gross_added_value: 'Valor adicionado bruto',
  depreciation_and_amortization: 'Depreciação e amortização',
  net_added_value: 'Valor adicionado líquido',
  added_value_received_on_transfer: 'Valor adicionado recebido em transferência',
  added_value_to_distribute: 'Valor adicionado a distribuir',
  team_remuneration: 'Pessoal',
  taxes: 'Impostos, taxas e contribuições',
  federal_taxes: 'Federais',
  state_taxes: 'Estaduais',
  municipal_taxes: 'Municipais',
  remuneration_of_third_party_capitals: 'Remuneração de capital de terceiros',
  own_equity_remuneration: 'Remuneração de capital próprio',
  dividends: 'Dividendos',
  interest_on_own_equity: 'Juros sobre capital próprio',
  retained_earnings_or_loss: 'Lucros retidos',
  non_controlling_share_of_retained_earnings: 'Participação de não controladores',
  distribution_of_added_value: 'Distribuição do valor adicionado',
}

export const statementLineLabel = (key: string) => STATEMENT_LINE_LABELS[key] ?? key

/** Uma linha do demonstrativo como métrica de série.
 *
 *  Existe para que a lista de métricas de cada aba seja uma lista de chaves e
 *  não um bloco de objetos repetidos — e para que o rótulo do seletor venha do
 *  mesmo mapa que nomeia a linha na tabela logo abaixo. Os dois discordarem
 *  seria a mesma linha com dois nomes na mesma tela.
 */
export const statementMetric = (key: string): PublishedSeriesMetric<StockStatementPoint> => ({
  key,
  label: statementLineLabel(key),
  read: (point) => point.lines[key],
  format: formatCompactBRL,
})
