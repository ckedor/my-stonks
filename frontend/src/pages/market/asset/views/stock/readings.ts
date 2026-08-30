import type {
  StockCashDividend,
  StockFundamentals,
  StockPriceRange,
  StockStatistics,
} from '@/api/market'

/** As leituras que a faixa de decisão faz do perfil da companhia.
 *
 *  São contas, não formatação: onde o preço está na faixa do ano, o quanto se
 *  paga pelo lucro e pelo patrimônio, se o negócio é bom, e o que a companhia
 *  pagou. Ficam fora dos cards porque cada uma tem uma regra de "não dá para
 *  dizer" que precisa ser testada — e um card que decide isso no meio do JSX
 *  esconde justamente o caso em que a frase não pode ser escrita.
 *
 *  Toda função devolve `null` quando o dado não sustenta a leitura. Nenhuma
 *  inventa zero: uma companhia sem P/L publicado não vale zero lucro, e uma
 *  que não pagou provento nos últimos doze meses não rendeu 0% — são coisas
 *  diferentes, e a faixa escreve frases diferentes para cada uma.
 */

/** O rótulo com que o provedor marca juros sobre capital próprio.
 *
 *  JCP tem retenção de imposto na fonte e dividendo não, então quem soma renda
 *  recebida não pode tratá-los como a mesma coisa. A separação é por rótulo e
 *  nunca por valor — não há nada no número que diga qual dos dois é. */
export const INTEREST_ON_EQUITY_LABEL = 'JCP'

export const isInterestOnEquity = (payment: StockCashDividend) =>
  payment.label?.trim().toUpperCase() === INTEREST_ON_EQUITY_LABEL

export interface PriceRangeReading {
  /** Onde o preço está entre o piso e o teto do ano: 0 é o piso, 1 é o teto. */
  position: number
  price: number
  low: number
  high: number
}

/** Onde o preço de hoje está na faixa das 52 semanas.
 *
 *  É o contexto mais barato que existe para um preço: R$ 43 não é caro nem
 *  barato, mas R$ 43 numa faixa que foi de 29 a 50 é uma posição que se lê sem
 *  saber nada da companhia.
 *
 *  Uma faixa degenerada — teto igual ao piso — não devolve leitura nenhuma. É
 *  divisão por zero disfarçada, e o papel que passou o ano parado não tem
 *  posição dentro de uma faixa que não existe.
 */
export function priceRangeReading(range: StockPriceRange | null): PriceRangeReading | null {
  const price = range?.price
  const low = range?.fifty_two_week_low
  const high = range?.fifty_two_week_high
  if (price == null || low == null || high == null || high <= low) return null

  // O preço pode sair da faixa entre a publicação dela e a cotação de agora:
  // uma máxima nova ainda não entrou no `fiftyTwoWeekHigh`. A posição é presa
  // aos extremos para que a barra não desenhe fora de si mesma.
  const position = Math.min(1, Math.max(0, (price - low) / (high - low)))
  return { position, price, low, high }
}

export interface ValuationReading {
  priceToEarnings: number | null
  priceToBook: number | null
}

/** O quanto se paga pelo lucro e pelo patrimônio.
 *
 *  Os dois múltiplos vêm como o provedor os publica e nunca são recalculados
 *  de preço e lucro por ação: a divisão daria um terceiro número, parecido e
 *  nosso, competindo com o que o mercado cota. É a mesma regra que o P/VP de
 *  um FII segue.
 *
 *  Um P/L ausente costuma significar prejuízo, e não dado faltando — mas quem
 *  diz isso é o lucro, não a ausência do múltiplo. A leitura só carrega o que
 *  veio; quem decide a frase é a faixa, com o lucro em mãos.
 */
export function valuationReading(statistics: StockStatistics | null): ValuationReading | null {
  if (!statistics) return null
  const { trailing_pe: priceToEarnings, price_to_book: priceToBook } = statistics
  if (priceToEarnings == null && priceToBook == null) return null
  return { priceToEarnings, priceToBook }
}

export interface QualityReading {
  returnOnEquity: number | null
  profitMargin: number | null
}

/** Se o negócio é bom, em duas medidas.
 *
 *  A margem é publicada por duas rotas ao mesmo tempo. É lida dos fundamentos
 *  e só deles, para que o número sob "margem" na faixa e o número no card de
 *  fundamentos não possam divergir num arredondamento — que é exatamente o
 *  tipo de diferença que ninguém percebe e todo mundo desconfia.
 */
export function qualityReading(fundamentals: StockFundamentals | null): QualityReading | null {
  if (!fundamentals) return null
  const { return_on_equity: returnOnEquity, profit_margin: profitMargin } = fundamentals
  if (returnOnEquity == null && profitMargin == null) return null
  return { returnOnEquity, profitMargin }
}

export interface DividendReading {
  /** O yield que o provedor publica, como razão. */
  yield12m: number | null
  /** O último pagamento já ocorrido. Nulo quando todos estão por vir. */
  last: StockCashDividend | null
  /** O próximo anunciado e ainda não pago, se houver. */
  upcoming: StockCashDividend | null
}

/** O que a companhia pagou, e o que já anunciou pagar.
 *
 *  O pagamento futuro é separado do último em vez de descartado. Uma companhia
 *  anuncia com meses de antecedência, e essa é justamente a linha que quem
 *  olha a tela quer ver — mas chamá-la de "último rendimento" diria que o
 *  dinheiro já entrou, o que não é verdade.
 *
 *  A fronteira é a data de hoje e não a última linha da lista, porque a lista
 *  vem ordenada por data de pagamento e a última pode ser um anúncio.
 */
export function dividendReading(
  payments: StockCashDividend[],
  statistics: StockStatistics | null,
  today: Date = new Date()
): DividendReading | null {
  const yield12m = statistics?.dividend_yield ?? null
  if (!payments.length && yield12m == null) return null

  const boundary = today.getTime()
  const paid = payments.filter(
    (payment) => payment.payment_date && new Date(payment.payment_date).getTime() <= boundary
  )
  const announced = payments.filter(
    (payment) => payment.payment_date && new Date(payment.payment_date).getTime() > boundary
  )

  return {
    yield12m,
    last: paid.length ? paid[paid.length - 1] : null,
    upcoming: announced.length ? announced[0] : null,
  }
}

/** Os últimos pagamentos em dinheiro, do mais antigo para o mais recente.
 *
 *  Só os que já ocorreram: uma barra de anúncio no meio da série faria a
 *  sparkline desenhar um futuro como se fosse histórico.
 */
export function recentPayments(
  payments: StockCashDividend[],
  count: number,
  today: Date = new Date()
): StockCashDividend[] {
  const boundary = today.getTime()
  return payments
    .filter(
      (payment) =>
        payment.value_per_share != null &&
        payment.payment_date &&
        new Date(payment.payment_date).getTime() <= boundary
    )
    .slice(-count)
}
