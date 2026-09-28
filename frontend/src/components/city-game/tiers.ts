/* A patente da cidade: um título a cada degrau de patrimônio, em dólar.

   É uma carreira, não uma nobreza: da rua ao escritório, do escritório ao
   mercado imobiliário e a Wall Street, até o topo.

   Os degraus começam curtos — um a cada US$ 5 mil — porque no começo cada
   pouco que se junta precisa aparecer na barra. Depois o passo cresce: de
   meio milhão para a frente o que muda é o tempo, e um degrau a cada cinco
   mil viraria uma barra que enche toda semana. A escala é fixa em código,
   como a da loja: um degrau novo é uma linha aqui.

   Mede o patrimônio de hoje, não o pico: o título desce quando a carteira
   desce, e a barra mede daqui até o degrau seguinte. */

export interface CityTier {
  /** A posição na escala, a partir de 1. */
  rank: number
  name: string
  thresholdUsd: number
}

/** Os nomes em ordem, e o passo em dólar entre um degrau e o seguinte. */
const STAGES: { step: number; names: string[] }[] = [
  {
    step: 5_000,
    names: [
      'Mendigo', 'Catador de latinhas', 'Flanelinha', 'Vendedor de bala no farol', 'Camelô',
      'Atendente de fast-food', 'Caixa de supermercado', 'Entregador de app', 'Motorista de aplicativo', 'Vendedor de loja',
      'Estagiário', 'Trainee', 'Assistente administrativo', 'Analista júnior', 'Analista pleno',
      'Analista sênior', 'Especialista', 'Coordenador', 'Gerente', 'Gerente regional',
    ],
  },
  {
    step: 10_000,
    names: [
      'Dono de food truck', 'Dono de franquia', 'Corretor de imóveis', 'Dono de quitinetes', 'Day trader',
      'Trader de mesa', 'Sócio da firma', 'Diretor', 'Fundador de startup', 'Dono de prédio',
    ],
  },
  {
    step: 25_000,
    names: [
      'Incorporador', 'Gestor de fundo', 'Vice-presidente', 'CEO',
      'Investidor-anjo', 'Capitalista de risco', 'Dono de shopping', 'Dono de hotel',
    ],
  },
  {
    step: 50_000,
    names: [
      'Magnata imobiliário', 'Tubarão do mercado', 'Dono de unicórnio',
      'Bilionário', 'Dono de banco', 'Lenda de Wall Street',
    ],
  },
  { step: 100_000, names: ['Dono da Bolsa', 'Dono do skyline', 'Dono da cidade'] },
  { step: 0, names: ['Rei do Mundo'] },
]

export const CITY_TIERS: CityTier[] = (() => {
  const tiers: CityTier[] = []
  let threshold = 0
  for (const { step, names } of STAGES) {
    for (const name of names) {
      tiers.push({ rank: tiers.length + 1, name, thresholdUsd: threshold })
      threshold += step
    }
  }
  return tiers
})()

export interface CityTierStanding {
  current: CityTier
  next: CityTier | null
  remainingUsd: number | null
  /** Quanto do trecho entre o degrau atual e o seguinte já foi andado, de 0 a 1. */
  progress: number
}

export function cityTierStanding(patrimonyUsd: number, tiers: CityTier[] = CITY_TIERS): CityTierStanding {
  const reached = tiers.filter(tier => tier.thresholdUsd <= patrimonyUsd)
  const current = reached[reached.length - 1] ?? tiers[0]
  const next = tiers[current.rank] ?? null
  if (!next) return { current, next, remainingUsd: null, progress: 1 }
  const span = next.thresholdUsd - current.thresholdUsd
  return {
    current,
    next,
    remainingUsd: next.thresholdUsd - patrimonyUsd,
    progress: Math.min(Math.max((patrimonyUsd - current.thresholdUsd) / span, 0), 1),
  }
}

/** Cinquenta anos adiante já não é previsão: acima disso, nenhuma data. */
const MAX_PROJECTION_MONTHS = 600

export interface CityTierProjection {
  months: number
  /** Primeiro dia do mês de chegada, `AAAA-MM-01`. */
  targetDate: string
}

/** Quando o patrimônio chega a `targetUsd` se nada mudar de ritmo — a mesma
 *  conta da patente antiga: o que já está dentro rende na taxa anual
 *  histórica da carteira (o CAGR, como fração) e o aporte médio mensal entra
 *  todo mês. Sem ritmo que chegue lá em cinquenta anos, `null`: melhor não
 *  dizer data nenhuma do que uma que a própria conta não sustenta. */
export function projectTierArrival(
  { patrimonyUsd, targetUsd, annualRate, monthlyContributionUsd, today }: {
    patrimonyUsd: number
    targetUsd: number
    annualRate: number
    monthlyContributionUsd: number
    today: string
  },
): CityTierProjection | null {
  const monthlyRate = (1 + Math.max(annualRate, 0)) ** (1 / 12) - 1
  const contribution = Math.max(monthlyContributionUsd, 0)
  let value = patrimonyUsd
  let months = 0
  while (value < targetUsd && months < MAX_PROJECTION_MONTHS) {
    value = value * (1 + monthlyRate) + contribution
    months++
  }
  if (value < targetUsd) return null
  const [year, month] = today.split('-').map(Number)
  const total = month - 1 + Math.max(months, 1)
  const target = `${year + Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
  return { months, targetDate: target }
}
