import type { PortfolioOverviewData } from '@/components/portfolio-overview/PortfolioOverviewScreen'
import type { Dividend, PatrimonyEntry, PortfolioPositionEntry, ReturnsEntry } from '@/types'

/* Uma carteira de mentira que se comporta como uma de verdade, para o
 * estúdio de temas desenhar o dashboard.
 *
 * Determinística: semente e data final fixas. Gerada a cada abertura, ela
 * mudaria o desenho entre uma visita e outra, e o snapshot do estúdio não
 * provaria nada.
 *
 * Coerente: o patrimônio sai de uma simulação dia a dia por categoria
 * (retorno diário com deriva e volatilidade próprias, mais o aporte do
 * mês), e as posições de hoje são o último dia dessa simulação repartido
 * entre os ativos — então o número do cabeçalho, a soma da tabela, a pizza
 * e o último ponto do gráfico de patrimônio são o mesmo número. */

const END = new Date(Date.UTC(2026, 8, 30))
const YEARS = 4

interface CategorySpec {
  name: string
  /** Retorno anual esperado e volatilidade anual. */
  drift: number
  vol: number
  /** Fatia de cada aporte, e o valor no primeiro dia. */
  share: number
  start: number
  assets: AssetSpec[]
}

interface AssetSpec {
  ticker: string | null
  name: string
  type: string
  class: string
  /** Fatia do valor da categoria. */
  weight: number
  price: number
  /** Quanto o preço médio fica abaixo do preço de hoje. */
  gain: number
  /** Provento por cota, e a cada quantos meses ele cai. */
  dividend?: { perShare: number; everyMonths: number; kind?: Dividend['kind'] }
}

const CATEGORIES: CategorySpec[] = [
  {
    name: 'Ações BR',
    drift: 0.13,
    vol: 0.22,
    share: 0.3,
    start: 52_000,
    assets: [
      { ticker: 'PETR4', name: 'Petrobras PN', type: 'Ação', class: 'Renda Variável', weight: 0.26, price: 38.42, gain: 0.31, dividend: { perShare: 1.12, everyMonths: 3 } },
      { ticker: 'ITUB4', name: 'Itaú Unibanco PN', type: 'Ação', class: 'Renda Variável', weight: 0.24, price: 35.9, gain: 0.22, dividend: { perShare: 0.42, everyMonths: 3, kind: 'interest_on_equity' } },
      { ticker: 'WEGE3', name: 'WEG ON', type: 'Ação', class: 'Renda Variável', weight: 0.2, price: 41.15, gain: -0.06 },
      { ticker: 'BBAS3', name: 'Banco do Brasil ON', type: 'Ação', class: 'Renda Variável', weight: 0.17, price: 27.8, gain: 0.18, dividend: { perShare: 0.71, everyMonths: 3 } },
      { ticker: 'VALE3', name: 'Vale ON', type: 'Ação', class: 'Renda Variável', weight: 0.13, price: 58.3, gain: -0.12, dividend: { perShare: 1.9, everyMonths: 6 } },
    ],
  },
  {
    name: 'FIIs',
    drift: 0.1,
    vol: 0.12,
    share: 0.25,
    start: 41_000,
    assets: [
      { ticker: 'HGLG11', name: 'CSHG Logística', type: 'FII', class: 'Renda Variável', weight: 0.32, price: 158.6, gain: 0.07, dividend: { perShare: 1.1, everyMonths: 1 } },
      { ticker: 'KNRI11', name: 'Kinea Renda Imobiliária', type: 'FII', class: 'Renda Variável', weight: 0.27, price: 141.2, gain: -0.03, dividend: { perShare: 1.0, everyMonths: 1 } },
      { ticker: 'XPML11', name: 'XP Malls', type: 'FII', class: 'Renda Variável', weight: 0.23, price: 104.9, gain: 0.05, dividend: { perShare: 0.92, everyMonths: 1 } },
      { ticker: 'MXRF11', name: 'Maxi Renda', type: 'FII', class: 'Renda Variável', weight: 0.18, price: 9.62, gain: -0.02, dividend: { perShare: 0.1, everyMonths: 1 } },
    ],
  },
  {
    name: 'Renda Fixa',
    drift: 0.112,
    vol: 0.012,
    share: 0.3,
    start: 68_000,
    assets: [
      { ticker: null, name: 'Tesouro IPCA+ 2035', type: 'Tesouro Direto', class: 'Renda Fixa', weight: 0.45, price: 2_214.37, gain: 0.19 },
      { ticker: null, name: 'CDB Banco Inter 110% CDI', type: 'CDB', class: 'Renda Fixa', weight: 0.35, price: 1_386.12, gain: 0.27 },
      { ticker: null, name: 'LCI Itaú 95% CDI', type: 'LCI', class: 'Renda Fixa', weight: 0.2, price: 1_154.8, gain: 0.12 },
    ],
  },
  {
    name: 'Exterior',
    drift: 0.15,
    vol: 0.18,
    share: 0.12,
    start: 22_000,
    assets: [
      { ticker: 'IVVB11', name: 'iShares S&P 500', type: 'ETF', class: 'Renda Variável', weight: 0.6, price: 368.5, gain: 0.34 },
      { ticker: 'NASD11', name: 'Trend Nasdaq 100', type: 'ETF', class: 'Renda Variável', weight: 0.4, price: 21.38, gain: 0.41 },
    ],
  },
  {
    name: 'Cripto',
    drift: 0.25,
    vol: 0.6,
    share: 0.03,
    start: 6_000,
    assets: [
      { ticker: 'BTC', name: 'Bitcoin', type: 'Criptomoeda', class: 'Cripto', weight: 0.75, price: 612_400, gain: 0.58 },
      { ticker: 'ETH', name: 'Ethereum', type: 'Criptomoeda', class: 'Cripto', weight: 0.25, price: 22_350, gain: -0.09 },
    ],
  },
]

const BENCHMARKS = {
  CDI: { drift: 0.112, vol: 0.002 },
  IBOV: { drift: 0.09, vol: 0.21 },
  IPCA: { drift: 0.048, vol: 0.004 },
}

/* Gerador com semente: Mulberry32. Pequeno e bom o bastante para dado de
   tela, e o que importa aqui é dar o mesmo número toda vez. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Normal padrão, por Box-Muller. */
function gaussian(random: () => number) {
  const u = Math.max(random(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random())
}

const iso = (date: Date) => date.toISOString().slice(0, 10)
const round2 = (value: number) => Math.round(value * 100) / 100

/** Os dias úteis (de segunda a sexta) do período. */
function businessDays(): Date[] {
  const days: Date[] = []
  const start = new Date(END)
  start.setUTCFullYear(END.getUTCFullYear() - YEARS)
  for (const day = new Date(start); day <= END; day.setUTCDate(day.getUTCDate() + 1)) {
    const weekday = day.getUTCDay()
    if (weekday !== 0 && weekday !== 6) days.push(new Date(day))
  }
  return days
}

/** Um passo diário de quem rende `drift` ao ano com volatilidade `vol`. */
const dailyStep = (random: () => number, drift: number, vol: number) =>
  drift / 252 + (vol / Math.sqrt(252)) * gaussian(random)

/* O aporte cai no primeiro dia útil de cada mês, crescendo com o tempo como
   cresce o salário de quem investe; de vez em quando um mês fica sem. */
function monthlyContribution(random: () => number, monthIndex: number) {
  if (random() < 0.12) return 0
  return Math.round((3_500 + monthIndex * 45 + random() * 1_500) / 50) * 50
}

/** Retorno acumulado (fração) a partir dos passos diários. */
function accumulate(days: Date[], steps: number[]): ReturnsEntry[] {
  let growth = 1
  return days.map((day, index) => {
    growth *= 1 + steps[index]
    return { date: iso(day), value: growth - 1 }
  })
}

const cagrOf = (series: ReturnsEntry[]) =>
  series.length ? (1 + series[series.length - 1].value) ** (1 / YEARS) - 1 : null

export function mockPortfolioOverview(categoryColors: string[]): PortfolioOverviewData {
  /* Semente escolhida pelo resultado: carteira a ~11% ao ano, perto do CDI,
     com uma categoria no vermelho (cripto) e as outras no azul — uma carteira
     comum, e não um sorteio que acabou bem ou mal demais para parecer real. */
  const random = seeded(1)
  const days = businessDays()

  const steps: Record<string, number[]> = {}
  for (const category of CATEGORIES) {
    steps[category.name] = days.map(() => dailyStep(random, category.drift, category.vol))
  }

  /* Patrimônio dia a dia: cada categoria rende o próprio passo e recebe a sua
     fatia do aporte do mês. A carteira é a soma. */
  const values = Object.fromEntries(CATEGORIES.map((category) => [category.name, category.start]))
  const portfolioSteps: number[] = []
  const patrimonyEvolution: PatrimonyEntry[] = []
  let monthIndex = -1
  let currentMonth = -1

  days.forEach((day, index) => {
    const before = CATEGORIES.reduce((sum, category) => sum + values[category.name], 0)
    for (const category of CATEGORIES) values[category.name] *= 1 + steps[category.name][index]
    const grown = CATEGORIES.reduce((sum, category) => sum + values[category.name], 0)
    portfolioSteps.push(index === 0 ? 0 : grown / before - 1)

    let aported = 0
    if (day.getUTCMonth() !== currentMonth) {
      currentMonth = day.getUTCMonth()
      monthIndex += 1
      aported = monthlyContribution(random, monthIndex)
      for (const category of CATEGORIES) values[category.name] += aported * category.share
    }

    const entry: PatrimonyEntry = { date: iso(day), portfolio: 0, aported }
    for (const category of CATEGORIES) entry[category.name] = round2(values[category.name])
    entry.portfolio = round2(CATEGORIES.reduce((sum, category) => sum + values[category.name], 0))
    patrimonyEvolution.push(entry)
  })

  /* As posições de hoje repartem o último valor de cada categoria pelos
     ativos dela. A quantidade sai do preço, e o preço médio do ganho. */
  let assetId = 0
  const positions: PortfolioPositionEntry[] = CATEGORIES.flatMap((category) =>
    category.assets.map((asset) => {
      assetId += 1
      const value = values[category.name] * asset.weight
      const quantity = asset.price > 10_000 ? value / asset.price : Math.max(1, Math.round(value / asset.price))
      const exactValue = round2(quantity * asset.price)
      const averagePrice = asset.price / (1 + asset.gain)
      return {
        asset_id: assetId,
        date: iso(END),
        ticker: asset.ticker,
        name: asset.name,
        quantity,
        average_price: round2(averagePrice),
        profit_pct: round2(asset.gain * 100),
        category: category.name,
        value: exactValue,
        price: asset.price,
        acc_return: asset.gain,
        twelve_months_return: asset.gain / 2.5,
        cagr: (1 + asset.gain) ** (1 / YEARS) - 1,
        total_invested: round2(quantity * averagePrice),
        type: asset.type,
        class: asset.class,
      }
    }),
  )

  /* A quantidade inteira de cotas desloca a soma em alguns reais: o último dia
     do patrimônio passa a ser exatamente a soma das posições, que é o número
     do cabeçalho. */
  const today = patrimonyEvolution[patrimonyEvolution.length - 1]
  for (const category of CATEGORIES) {
    today[category.name] = round2(
      positions.filter((p) => p.category === category.name).reduce((sum, p) => sum + p.value, 0),
    )
  }
  today.portfolio = round2(positions.reduce((sum, p) => sum + p.value, 0))

  /* Proventos: cada ativo que paga, na sua periodicidade, sobre a quantidade
     que a carteira tinha naquele mês — que cresce com os aportes. */
  const dividends: Dividend[] = []
  const firstMonth = new Date(days[0])
  for (const category of CATEGORIES) {
    for (const asset of category.assets) {
      if (!asset.dividend) continue
      const position = positions.find((p) => p.name === asset.name)!
      for (let month = 0; month < YEARS * 12; month += asset.dividend.everyMonths) {
        const date = new Date(Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + month, 15))
        if (date > END) break
        const held = position.quantity * (0.35 + (0.65 * month) / (YEARS * 12))
        const amount = round2(held * asset.dividend.perShare * (0.9 + random() * 0.2))
        dividends.push({
          id: dividends.length + 1,
          asset_id: position.asset_id,
          date: iso(date),
          ticker: asset.ticker ?? asset.name,
          amount,
          kind: asset.dividend.kind ?? 'dividend',
          category: category.name,
          portfolio_id: 1,
        })
      }
    }
  }

  const series: Record<string, ReturnsEntry[]> = {
    portfolio: accumulate(days, portfolioSteps),
  }
  for (const category of CATEGORIES) series[category.name] = accumulate(days, steps[category.name])

  const cagr = Object.fromEntries(Object.entries(series).map(([key, curve]) => [key, cagrOf(curve)]))

  const benchmarks = Object.fromEntries(
    Object.entries(BENCHMARKS).map(([name, { drift, vol }]) => [
      name,
      accumulate(days, days.map(() => dailyStep(random, drift, vol))),
    ]),
  )

  const cdiCagr = cagrOf(benchmarks.CDI)

  return {
    positions,
    categories: CATEGORIES.map((category, index) => ({
      name: category.name,
      color: categoryColors[index % categoryColors.length],
    })),
    patrimonyEvolution,
    dividends,
    returnCurves: { series, cagr },
    benchmarks,
    cdiCagr: cdiCagr != null ? cdiCagr * 100 : null,
  }
}
