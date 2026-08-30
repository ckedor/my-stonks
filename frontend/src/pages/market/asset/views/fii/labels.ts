import type { FIIMonthlyReport } from '@/api/market'

/** How the quarterly filing's asset classes are written on the page.
 *
 *  The codes are the provider's and never reach the screen as they are. A code
 *  that is not listed is written as it came rather than folded into "Outros":
 *  a class the provider starts publishing should show up as itself, not hide
 *  inside a bucket that says nothing.
 */
const ASSET_CLASS_LABELS: Record<string, string> = {
  real_estate: 'Imóveis',
  cri: 'CRI',
  lci: 'LCI',
  fii: 'Cotas de FII',
  real_estate_company: 'Companhias imobiliárias',
}

export const assetClassLabel = (assetClass: string) =>
  ASSET_CLASS_LABELS[assetClass] ?? assetClass

/** De que é feito o patrimônio, nas palavras da tela e na ordem em que um
 *  fundo se lê: o que ele tem, o que emprestou, o que tem a receber e o que
 *  está em caixa.
 *
 *  Uma lista só para os dois lugares que a leem — a tabela do informe mensal e
 *  a pizza da carteira. Duas listas divergiriam na primeira linha nova, e a
 *  tela mostraria composições diferentes em duas abas.
 */
export const PATRIMONY_LINES: {
  label: string
  read: (report: FIIMonthlyReport) => number | null
}[] = [
  { label: 'Imóveis', read: (report) => report.real_estate },
  { label: 'CRI', read: (report) => report.cri },
  { label: 'LCI', read: (report) => report.lci },
  { label: 'Cotas de FII', read: (report) => report.fii_holdings },
  { label: 'Ações de companhias imobiliárias', read: (report) => report.real_estate_company_shares },
  { label: 'Cotas de companhias imobiliárias', read: (report) => report.real_estate_company_units },
  { label: 'Recebíveis de aluguel', read: (report) => report.rental_receivables },
  { label: 'Outros recebíveis', read: (report) => report.other_receivables },
  { label: 'Fundos de renda fixa', read: (report) => report.fixed_income_funds },
  { label: 'Títulos públicos', read: (report) => report.government_bonds },
  { label: 'Títulos privados', read: (report) => report.private_bonds },
  { label: 'Caixa', read: (report) => report.cash },
]
