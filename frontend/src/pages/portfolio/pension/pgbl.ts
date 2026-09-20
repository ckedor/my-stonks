/* Quanto aportar em PGBL no ano, e quanto disso volta como restituição.
 *
 * A regra é uma só: o que entra num PGBL abate da base do imposto de renda,
 * até **12% da renda bruta tributável do ano**. Não é isenção, é adiamento —
 * o imposto será cobrado lá na frente, sobre o valor total resgatado. O que a
 * tela responde é a pergunta do ano corrente: qual é o teto de aporte e
 * quanto ele devolve de imposto.
 *
 * Duas condições que a conta assume, e que valem para um CLT:
 *
 * - **Declaração completa.** No desconto simplificado o PGBL não abate nada,
 *   porque os 20% substituem todas as deduções. Por isso a restituição aqui
 *   não é comparada contra a completa sem PGBL, e sim contra a **melhor das
 *   duas sem PGBL**: quem hoje entrega a simplificada só ganha o que passar
 *   dela, e mostrar a diferença contra a completa inflaria o número.
 * - **Contribuição ao INSS em dia.** É requisito legal do abatimento, e um
 *   CLT satisfaz por folha.
 *
 * O que fica de fora, de propósito: 13º salário e PLR são tributados
 * exclusivamente na fonte, não entram no ajuste anual e portanto nem compõem
 * a renda que dá direito aos 12%, nem têm imposto que o PGBL possa reduzir.
 * Dependentes, despesas médicas e educação também ficam de fora — cada um
 * deles muda a base, e a tela pede salário e bônus apenas.
 */

/** Uma faixa da tabela progressiva: até onde vai, a que alíquota, e a parcela
 *  a deduzir que transforma a progressividade numa conta de uma linha. */
interface IrpfBracket {
  /** Teto mensal da faixa. `Infinity` na última. */
  ceiling: number
  rate: number
  /** Parcela a deduzir mensal. */
  deduction: number
}

/** Tabela progressiva mensal do IRPF vigente desde maio/2025.
 *
 *  Mensal e não anual porque é como a Receita a publica e como se confere
 *  contra o holerite; o ano é ela vezes doze, feito em `annualBrackets`. Um
 *  único lugar para atualizar quando a tabela mudar. */
const IRPF_MONTHLY_BRACKETS: IrpfBracket[] = [
  { ceiling: 2_428.8, rate: 0, deduction: 0 },
  { ceiling: 2_826.65, rate: 0.075, deduction: 182.16 },
  { ceiling: 3_751.05, rate: 0.15, deduction: 394.16 },
  { ceiling: 4_664.68, rate: 0.225, deduction: 675.49 },
  { ceiling: Infinity, rate: 0.275, deduction: 908.73 },
]

/** Faixas de contribuição do INSS para o empregado, 2025. A alíquota de cada
 *  faixa incide só sobre a parte do salário dentro dela, e acima do último
 *  teto não há contribuição — é o que faz o desconto parar de crescer. */
const INSS_BRACKETS: { ceiling: number; rate: number }[] = [
  { ceiling: 1_518.0, rate: 0.075 },
  { ceiling: 2_793.88, rate: 0.09 },
  { ceiling: 4_190.83, rate: 0.12 },
  { ceiling: 8_157.41, rate: 0.14 },
]

/** O teto do abatimento: 12% da renda bruta tributável do ano. */
const PGBL_LIMIT_RATE = 0.12

/** Desconto simplificado: 20% da renda tributável, limitado ao teto abaixo.
 *  Ele substitui todas as deduções, inclusive o PGBL. */
const SIMPLIFIED_DISCOUNT_RATE = 0.2
export const SIMPLIFIED_DISCOUNT_CAP = 16_754.34

/** A tabela anual, que é a mensal vezes doze. */
function annualBrackets(): IrpfBracket[] {
  return IRPF_MONTHLY_BRACKETS.map((bracket) => ({
    ceiling: bracket.ceiling * 12,
    rate: bracket.rate,
    deduction: bracket.deduction * 12,
  }))
}

/** O imposto anual devido sobre uma base já líquida de deduções. */
export function annualTax(base: number): number {
  if (!(base > 0)) return 0
  const bracket = annualBrackets().find((candidate) => base <= candidate.ceiling)
  if (!bracket) return 0
  return Math.max(base * bracket.rate - bracket.deduction, 0)
}

/** A contribuição ao INSS sobre o que se recebeu num mês. */
export function monthlyInss(income: number): number {
  if (!(income > 0)) return 0

  let contribution = 0
  let floor = 0
  for (const bracket of INSS_BRACKETS) {
    const taxable = Math.min(income, bracket.ceiling) - floor
    if (taxable <= 0) break
    contribution += taxable * bracket.rate
    floor = bracket.ceiling
  }
  return contribution
}

/** O que sai de salário e bônus. */
interface PgblInput {
  /** Salário bruto mensal. */
  monthlySalary: number
  /** Bônus, gratificação ou outro extra tributável, no total do ano. */
  annualBonus: number
}

/** Um pedaço do abatimento e a faixa em que ele cai.
 *
 *  O abatimento desce a tabela: o primeiro real deduzido economiza na
 *  alíquota do topo, e os últimos podem já estar numa faixa mais baixa. É o
 *  que explica por que a restituição não é simplesmente 27,5% do aporte. */
export interface PgblTranche {
  rate: number
  /** Quanto do aporte abate dentro desta faixa. */
  amount: number
  /** O imposto que este pedaço deixa de ser pago. */
  saving: number
}

export interface PgblPlan {
  /** Renda bruta tributável do ano: salário e bônus, antes do INSS. É sobre
   *  ela que incidem os 12%. */
  grossIncome: number
  /** INSS do ano, deduzido da base na declaração completa. */
  inss: number
  /** O aporte que esgota o abatimento: 12% da renda bruta tributável. */
  contributionLimit: number
  /** O mesmo valor dividido por doze, para quem aporta mês a mês. */
  monthlyContribution: number
  /** O que de fato abate: o teto, ou a base inteira quando ela é menor. */
  deduction: number
  /** Base da completa sem PGBL: a renda menos o INSS. */
  completeBase: number
  /** Base da simplificada: a renda menos o desconto de 20%. */
  simplifiedBase: number
  /** Base da completa com o aporte abatido. */
  baseWithPgbl: number
  /** Imposto na completa, sem PGBL. */
  taxComplete: number
  /** Imposto na simplificada — que ignora o PGBL por construção. */
  taxSimplified: number
  /** Imposto na completa, com o aporte do teto abatido. */
  taxWithPgbl: number
  /** Se, sem PGBL, a simplificada é a melhor das duas. Quando é, a
   *  restituição mede contra ela, e não contra a completa. */
  simplifiedWinsWithoutPgbl: boolean
  /** O que o aporte devolve: o melhor cenário sem PGBL menos a completa com
   *  ele. Zero quando não há imposto a reduzir. */
  refund: number
  /** A restituição como fração do aporte. Zero quando não há aporte. */
  refundRate: number
  /** De onde vem a economia, faixa a faixa. Soma `taxComplete −
   *  taxWithPgbl`, que é a economia dentro da completa; quando a
   *  simplificada vence sem PGBL, a restituição da linha de cima é menor
   *  que essa soma, pela diferença que a simplificada já dava de graça. */
  tranches: PgblTranche[]
}

/** O abatimento repartido pelas faixas que ele atravessa, de cima para baixo. */
function splitByBracket(base: number, deduction: number): PgblTranche[] {
  const brackets = annualBrackets()
  const tranches: PgblTranche[] = []

  let top = base
  let remaining = deduction

  for (let index = brackets.length - 1; index >= 0 && remaining > 0; index--) {
    const floor = index === 0 ? 0 : brackets[index - 1].ceiling
    if (top <= floor) continue

    const amount = Math.min(top - floor, remaining)
    if (brackets[index].rate > 0) {
      tranches.push({
        rate: brackets[index].rate,
        amount,
        saving: amount * brackets[index].rate,
      })
    }
    remaining -= amount
    top -= amount
  }

  return tranches
}

/**
 * Quanto aportar em PGBL no ano e o que isso devolve de imposto.
 *
 * Entrada negativa ou zerada devolve um plano zerado: sem renda não há teto
 * de abatimento nem imposto a reduzir, e zero é a resposta honesta.
 */
export function planPgbl({ monthlySalary, annualBonus }: PgblInput): PgblPlan {
  const salary = Math.max(monthlySalary, 0)
  const bonus = Math.max(annualBonus, 0)

  const grossIncome = salary * 12 + bonus

  /* O bônus cai num mês só, e naquele mês o INSS incide sobre a soma — quase
     sempre já acima do teto, que é justamente por que somar uma contribuição
     à parte pelo bônus estouraria o desconto real. */
  const inss = monthlyInss(salary) * 11 + monthlyInss(salary + bonus)

  const contributionLimit = grossIncome * PGBL_LIMIT_RATE
  const completeBase = Math.max(grossIncome - inss, 0)
  const simplifiedBase = Math.max(
    grossIncome - Math.min(grossIncome * SIMPLIFIED_DISCOUNT_RATE, SIMPLIFIED_DISCOUNT_CAP),
    0,
  )

  const taxComplete = annualTax(completeBase)
  const taxSimplified = annualTax(simplifiedBase)
  const deduction = Math.min(contributionLimit, completeBase)
  const baseWithPgbl = completeBase - deduction
  const taxWithPgbl = annualTax(baseWithPgbl)

  const baseline = Math.min(taxComplete, taxSimplified)
  const refund = Math.max(baseline - taxWithPgbl, 0)

  return {
    grossIncome,
    inss,
    contributionLimit,
    monthlyContribution: contributionLimit / 12,
    deduction,
    completeBase,
    simplifiedBase,
    baseWithPgbl,
    taxComplete,
    taxSimplified,
    taxWithPgbl,
    simplifiedWinsWithoutPgbl: taxSimplified < taxComplete,
    refund,
    refundRate: contributionLimit > 0 ? refund / contributionLimit : 0,
    tranches: splitByBracket(completeBase, deduction),
  }
}
