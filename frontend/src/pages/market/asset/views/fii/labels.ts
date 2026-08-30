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
