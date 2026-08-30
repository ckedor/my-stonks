/** O que é de tela num fundo de investimento: como cada família e cada grupo
 *  da carteira se chamam para o leitor.
 *
 *  Um fundo de investimento aqui é o que não é FII nem ETF. Quem decide a que
 *  família um fundo pertence é o backend, que devolve `kind` junto com ele —
 *  aqui só se nomeia, e nunca se deduz do ticker: terminar em 11 não diz de
 *  que tipo o fundo é, e JURO11 é FI-Infra.
 *
 *  Uma família que o provedor passe a publicar aparece como veio, em vez de
 *  cair num "Outros" que não diz nada: um `fidc` novo tem de se ver na tela
 *  como `fidc` até alguém escrever o rótulo dele.
 */

const FUND_KIND_LABELS: Record<string, string> = {
  fiagro: 'FIAGRO',
  fiinfra: 'FI-Infra',
  fidc: 'FIDC',
  fip: 'FIP',
  fif: 'FIF',
  other: 'Outros',
}

export const fundKindLabel = (kind: string | null) =>
  kind ? (FUND_KIND_LABELS[kind] ?? kind.toUpperCase()) : 'Não classificado'

/** Os grupos em que a carteira trimestral chega, na ordem em que se lê um
 *  fundo: o que ele tem, o que emprestou, o que tem a receber e o que deve.
 *
 *  Os dois últimos não são coisas possuídas — são direito e obrigação —, e é
 *  por isso que ficam no fim e nunca entram numa soma do que o fundo tem.
 */
const FUND_BUCKET_LABELS: Record<string, string> = {
  public_bonds: 'Títulos públicos',
  credit_assets: 'Ativos de crédito',
  fund_holdings: 'Cotas de fundos',
  listed_securities: 'Valores mobiliários listados',
  receivables: 'A receber',
  payables: 'A pagar',
}

/** A ordem em que os grupos se leem, e a única lista que a decide. */
export const FUND_BUCKET_ORDER = [
  'public_bonds',
  'credit_assets',
  'fund_holdings',
  'listed_securities',
  'receivables',
  'payables',
] as const

/** Grupos que são direito ou obrigação, e não coisa possuída. Somá-los ao que
 *  o fundo tem infla a carteira; é o que a pizza da composição deixa de fora. */
export const FUND_LIABILITY_BUCKETS = new Set(['receivables', 'payables'])

export const fundBucketLabel = (bucket: string) => FUND_BUCKET_LABELS[bucket] ?? bucket
