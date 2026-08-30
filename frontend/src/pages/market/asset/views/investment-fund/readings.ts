import type {
  InvestmentFundDividend,
  InvestmentFundHolding,
  InvestmentFundIndicators,
  InvestmentFundNavPoint,
} from '@/api/market'
import { FUND_BUCKET_ORDER, FUND_LIABILITY_BUCKETS, fundBucketLabel } from '@/constants/investmentFunds'

/** As leituras que a faixa de decisão faz do perfil de um fundo.
 *
 *  São contas, não formatação: quanto a cota se afasta do valor patrimonial, se
 *  o último rendimento subiu ou caiu, para onde andou o valor da cota e de que
 *  a carteira é feita. Ficam fora dos cards porque cada uma tem uma regra de
 *  "não dá para dizer" que precisa ser testada — e um card que decide isso no
 *  meio do JSX esconde justamente o caso em que a frase não pode ser escrita.
 *
 *  Toda função devolve `null` quando o dado não sustenta a leitura. Nenhuma
 *  inventa zero: um fundo sem P/VP publicado não negocia ao par, e um fundo com
 *  um único arquivamento não variou — ele não tem contra o quê variar.
 */

/** O rótulo que o provedor dá a uma distribuição comum. Fundos também amortizam
 *  capital, que chega pela mesma rota com rótulo próprio e é devolução de
 *  principal, não renda — somar os dois superestimaria o que o fundo paga.
 *  Pagamento sem rótulo é lido como rendimento, que é o que essas rotas
 *  majoritariamente carregam. */
const INCOME_LABEL = 'RENDIMENTO'

export const isIncome = (dividend: InvestmentFundDividend) =>
  !dividend.event_type || dividend.event_type.toUpperCase() === INCOME_LABEL

export interface NavReading {
  /** Razão do afastamento: −0,022 é 2,2% abaixo do valor patrimonial. */
  deviation: number
  direction: 'above' | 'below' | 'at'
  price: number | null
  navPerShare: number | null
  /** A data do informe de onde o P/VP veio. Pode ter semanas. */
  asOfDate: string | null
}

/** Quanto a cota se afasta do valor patrimonial, a partir do P/VP publicado.
 *
 *  O múltiplo é lido como o fundo publicou e nunca recalculado de `price` e
 *  `nav_per_share`: os dois vêm do mesmo informe, e dividir um pelo outro aqui
 *  produziria um terceiro número, parecido e nosso, no lugar do que o fundo
 *  declarou. Sem o múltiplo não há leitura, mesmo que os dois preços estejam
 *  presentes.
 */
export function navReading(indicators: InvestmentFundIndicators | null): NavReading | null {
  const multiple = indicators?.price_to_nav
  if (!indicators || multiple == null) return null

  const deviation = multiple - 1
  return {
    deviation,
    direction: deviation > 0 ? 'above' : deviation < 0 ? 'below' : 'at',
    price: indicators.price,
    navPerShare: indicators.nav_per_share,
    asOfDate: indicators.as_of_date,
  }
}

export interface IncomeTrend {
  last: InvestmentFundDividend
  previous: InvestmentFundDividend | null
  /** Variação relativa entre os dois: −0,089 é uma queda de 8,9%. Ausente
   *  quando não há pagamento anterior, ou quando o anterior foi zero e a
   *  divisão não diria nada. */
  change: number | null
}

/** O último rendimento e o que ele foi da vez anterior.
 *
 *  Só rendimento: uma amortização de capital no meio da série faria a
 *  comparação medir a devolução de principal contra a renda do período. A ordem
 *  chega ascendente do backend, mas é imposta aqui de novo — a leitura não pode
 *  depender de quem chamou ter ordenado.
 *
 *  "Vez anterior" e não "mês anterior": o provedor diz que não estima
 *  periodicidade porque fundos desses tipos não têm uma, e a comparação é entre
 *  dois pagamentos, sem afirmar quanto tempo passou entre eles.
 */
export function incomeTrend(dividends: InvestmentFundDividend[]): IncomeTrend | null {
  const income = dividends
    .filter(isIncome)
    .slice()
    .sort((a, b) => a.payment_date.localeCompare(b.payment_date))

  const last = income.at(-1)
  if (!last) return null

  const previous = income.at(-2) ?? null
  const change =
    previous && previous.value_per_share !== 0
      ? (last.value_per_share - previous.value_per_share) / previous.value_per_share
      : null

  return { last, previous, change }
}

export interface NavTrend {
  /** O valor da cota no arquivamento mais recente. */
  navPerShare: number
  date: string
  /** Variação relativa contra o arquivamento comparável anterior: 0,0031 é
   *  +0,31%. Ausente quando não há anterior com valor publicado. */
  change: number | null
  previousDate: string | null
  /** A classe ou série a que os dois pertencem, quando o fundo arquiva por
   *  classe. Um FIDC tem sênior e subordinada, e comparar uma com a outra
   *  mediria a diferença entre elas e não a variação de nenhuma. */
  classOrSeries: string | null
}

/** Para onde o valor da cota andou, entre os dois últimos arquivamentos dela.
 *
 *  Um fundo que arquiva por classe tem várias séries na mesma lista, e o
 *  recorte é sempre dentro de uma classe: a comparação é da cota consigo mesma.
 *  A classe escolhida é a do arquivamento mais recente — é a que o leitor vê
 *  em cima —, e o anterior é o último arquivamento daquela mesma classe.
 */
export function navTrend(history: InvestmentFundNavPoint[]): NavTrend | null {
  const filed = history
    .filter((point) => point.nav_per_share != null)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))

  const last = filed.at(-1)
  if (!last) return null

  const sameClass = filed.filter((point) => point.class_or_series === last.class_or_series)
  const previous = sameClass.at(-2) ?? null
  const change =
    previous && previous.nav_per_share
      ? (last.nav_per_share as number) / previous.nav_per_share - 1
      : null

  return {
    navPerShare: last.nav_per_share as number,
    date: last.date,
    change,
    previousDate: change == null ? null : (previous?.date ?? null),
    classOrSeries: last.class_or_series,
  }
}

export interface PortfolioSlice {
  label: string
  value: number
}

/** De que a carteira é feita, em reais, para ser desenhada.
 *
 *  Só o que o fundo possui: "a receber" é direito e "a pagar" é obrigação, e uma
 *  fatia de obrigação numa pizza do que o fundo tem afirmaria que ele possui a
 *  própria dívida. Eles continuam na tabela, que é onde uma obrigação se lê.
 *
 *  Fatia de valor zero fica de fora: ela não desenha setor nenhum e ainda empurra
 *  um rótulo solto para a borda do gráfico.
 */
export function portfolioSlices(holdings: InvestmentFundHolding[]): PortfolioSlice[] {
  const totals = new Map<string, number>()

  for (const holding of holdings) {
    if (FUND_LIABILITY_BUCKETS.has(holding.bucket)) continue
    const value = holding.market_value
    if (value == null || value <= 0) continue
    totals.set(holding.bucket, (totals.get(holding.bucket) ?? 0) + value)
  }

  return FUND_BUCKET_ORDER.filter((bucket) => totals.has(bucket)).map((bucket) => ({
    label: fundBucketLabel(bucket),
    value: totals.get(bucket) as number,
  }))
}

/** As linhas de um grupo da carteira, na ordem em que a tela lê os grupos.
 *
 *  Um grupo sem linha nenhuma não vira seção: uma tabela "Cotas de fundos"
 *  vazia num fundo que não tem nenhuma faria o leitor procurar o que não
 *  existe.
 */
export function holdingsByBucket(
  holdings: InvestmentFundHolding[],
): { bucket: string; label: string; holdings: InvestmentFundHolding[] }[] {
  return FUND_BUCKET_ORDER.map((bucket) => ({
    bucket,
    label: fundBucketLabel(bucket),
    holdings: holdings.filter((holding) => holding.bucket === bucket),
  })).filter((group) => group.holdings.length > 0)
}
