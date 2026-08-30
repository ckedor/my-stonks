import type {
  FIIAllocation,
  FIIDividend,
  FIIIndicators,
  FIIMonthlyReport,
  FIIPropertiesPoint,
  FIIPropertySummary,
} from '@/api/market'
import { assetClassLabel, PATRIMONY_LINES } from './labels'

/** As três leituras que a faixa de decisão faz do perfil do fundo.
 *
 *  São contas, não formatação: quanto a cota se afasta do valor patrimonial,
 *  se o último rendimento subiu ou caiu, e para onde foi a vacância. Ficam
 *  fora dos cards porque cada uma tem uma regra de "não dá para dizer" que
 *  precisa ser testada — e um card que decide isso no meio do JSX esconde
 *  justamente o caso em que a frase não pode ser escrita.
 *
 *  Toda função devolve `null` quando o dado não sustenta a leitura. Nenhuma
 *  inventa zero: um fundo sem P/VP publicado não negocia ao par, e um fundo
 *  com um único pagamento não teve variação nenhuma — ele não tem contra o
 *  quê variar.
 */

/** O rótulo que o provedor dá a uma distribuição comum. Fundos também
 *  amortizam capital, que chega pela mesma rota com rótulo próprio e é
 *  devolução de principal, não renda — somar os dois superestimaria o que o
 *  fundo paga. Pagamento sem rótulo é lido como rendimento, que é o que essas
 *  rotas majoritariamente carregam. */
const INCOME_LABEL = 'RENDIMENTO'

export const isIncome = (dividend: FIIDividend) =>
  !dividend.event_type || dividend.event_type.toUpperCase() === INCOME_LABEL

export interface NavReading {
  /** Razão do afastamento: 0,018 é 1,8% acima do valor patrimonial. */
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
export function navReading(indicators: FIIIndicators | null): NavReading | null {
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
  last: FIIDividend
  previous: FIIDividend | null
  /** Variação relativa entre os dois: −0,089 é uma queda de 8,9%. Ausente
   *  quando não há pagamento anterior, ou quando o anterior foi zero e a
   *  divisão não diria nada. */
  change: number | null
}

/** O último rendimento e o que ele foi da vez anterior.
 *
 *  Só rendimento: uma amortização de capital no meio da série faria a
 *  comparação medir a devolução de principal contra a renda do mês. A ordem
 *  chega ascendente do backend, mas é imposta aqui de novo — a leitura não
 *  pode depender de quem chamou ter ordenado.
 */
export function incomeTrend(dividends: FIIDividend[]): IncomeTrend | null {
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

export interface VacancyReading {
  rate: number | null
  averageRate: number | null
  count: number | null
  totalArea: number | null
  /** Diferença contra o trimestre anterior, em razão: 0,0037 é +0,37 p.p. */
  change: number | null
  previousDate: string | null
}

interface VacancySource {
  /** O consolidado do trimestre corrente, do informe já itemizado. */
  summary: FIIPropertySummary | null
  /** A série trimestral, em qualquer ordem. */
  history: FIIPropertiesPoint[]
}

/** A vacância de agora e para onde ela andou.
 *
 *  Os números correntes vêm do informe itemizado quando ele chegou, e da
 *  última ponta da série quando não chegou. O delta sai sempre dos dois
 *  últimos trimestres da série, nunca de misturar as duas fontes: elas podem
 *  estar em trimestres diferentes, e uma diferença entre trimestres distintos
 *  não é uma variação, é um erro com aparência de número.
 */
export function vacancyReading({ summary, history }: VacancySource): VacancyReading | null {
  const quarters = history
    .filter((quarter) => quarter.reference_date && quarter.summary)
    .slice()
    .sort((a, b) => (a.reference_date as string).localeCompare(b.reference_date as string))

  const current = summary ?? quarters.at(-1)?.summary ?? null
  if (!current) return null

  const [before, latest] = [quarters.at(-2), quarters.at(-1)]
  const change =
    before?.summary?.vacancy_rate != null && latest?.summary?.vacancy_rate != null
      ? latest.summary.vacancy_rate - before.summary.vacancy_rate
      : null

  return {
    rate: current.vacancy_rate,
    averageRate: current.average_vacancy_rate,
    count: current.count,
    totalArea: current.total_area,
    change,
    previousDate: change == null ? null : (before?.reference_date ?? null),
  }
}

export interface PatrimonySlices {
  slices: { label: string; value: number }[]
  /** De onde a fatia veio: o informe mensal precifica tudo, inclusive os
   *  imóveis; o trimestral só precifica o que não é prédio. */
  source: 'report' | 'quarter'
}

/** De que é feita a carteira, em reais, para ser desenhada.
 *
 *  O informe mensal vem primeiro por dois motivos: ele é mais recente e é o
 *  único que põe preço nos imóveis. O trimestral conta e descreve os prédios
 *  sem declarar valor para eles, então uma pizza feita dele mostraria um fundo
 *  de tijolo como se fosse só o punhado de CRI que ele carrega — o que é
 *  falso, e pior do que não desenhar nada.
 *
 *  Fatia de valor zero fica de fora: ela não desenha setor nenhum e ainda
 *  empurra um rótulo solto para a borda do gráfico.
 */
export function patrimonySlices({
  report,
  allocations,
}: {
  report: FIIMonthlyReport | null
  allocations: FIIAllocation[]
}): PatrimonySlices | null {
  const filed = report
    ? PATRIMONY_LINES.map(({ label, read }) => ({ label, value: read(report) ?? 0 })).filter(
        (slice) => slice.value > 0
      )
    : []

  if (filed.length > 0) return { slices: filed, source: 'report' }

  const quarterly = allocations
    .filter((allocation) => (allocation.value ?? 0) > 0)
    .map((allocation) => ({
      label: assetClassLabel(allocation.asset_class),
      value: allocation.value as number,
    }))

  return quarterly.length > 0 ? { slices: quarterly, source: 'quarter' } : null
}
