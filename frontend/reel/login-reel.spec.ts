import { writeFileSync } from 'node:fs'

import { test } from '../e2e/fixtures/app'

/* Roteiro do vídeo da tela de login. A carteira é inventada — a tela de login
   é pública, e um vídeo da carteira real mostraria o patrimônio de alguém a
   quem nem entrou. As séries saem de uma fórmula fixa, então regravar dá o
   mesmo vídeo. */

const HOJE = new Date('2026-09-25T12:00:00-03:00')
const INICIO = new Date('2024-09-25T12:00:00-03:00')
const WEEK = 7 * 24 * 3600 * 1000

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Semanas do início até hoje, com uma caminhada que sobe com ondulação. */
const WEEKS = Array.from({ length: Math.floor((+HOJE - +INICIO) / WEEK) + 1 }, (_, i) => {
  const t = i / 104
  const wave = 0.012 * Math.sin(i / 4.3) + 0.006 * Math.sin(i / 1.3 + 1) + 0.004 * Math.sin(i * 2.1)
  /* Uma queda de verdade no meio do caminho, que se recupera: sem ela o
     drawdown da tela de Risco é uma franja de -0,5%. */
  const dip = -0.08 * Math.exp(-(((i - 58) / 5) ** 2))
  return { date: iso(new Date(+INICIO + i * WEEK)), i, t, wave, dip }
})

const PORTFOLIOS = [
  {
    id: 1,
    name: 'Principal',
    user_id: 1,
    custom_categories: [
      { id: 10, name: 'Ações', color: '#9FD3DF', benchmark_id: null },
      { id: 11, name: 'FIIs', color: '#86B87A', benchmark_id: null },
      { id: 12, name: 'Exterior', color: '#A896D8', benchmark_id: null },
      { id: 13, name: 'Renda Fixa', color: '#D2A85F', benchmark_id: null },
    ],
  },
]

type Position = [ticker: string, name: string, category: string, type: string, klass: string, qty: number, avg: number, price: number]
const POSITIONS: Position[] = [
  ['PETR4', 'Petrobras PN', 'Ações', 'Ação', 'Renda Variável', 900, 31.2, 38.4],
  ['ITUB4', 'Itaú Unibanco PN', 'Ações', 'Ação', 'Renda Variável', 1200, 27.9, 36.1],
  ['WEGE3', 'WEG ON', 'Ações', 'Ação', 'Renda Variável', 450, 38.5, 52.3],
  ['HGLG11', 'CSHG Logística', 'FIIs', 'FII', 'Renda Variável', 180, 158.2, 162.7],
  ['KNRI11', 'Kinea Renda Imobiliária', 'FIIs', 'FII', 'Renda Variável', 220, 139.4, 146.2],
  ['IVVB11', 'iShares S&P 500', 'Exterior', 'ETF', 'Renda Variável', 260, 280.1, 356.8],
  ['TESOURO IPCA+ 2035', 'Tesouro IPCA+ 2035', 'Renda Fixa', 'Tesouro Direto', 'Renda Fixa', 30, 2850, 3310],
]

const POSICOES = POSITIONS.map(([ticker, name, category, type, klass, quantity, avg, price], i) => {
  const value = quantity * price
  const invested = quantity * avg
  const ret = value / invested - 1
  return {
    asset_id: i + 1, date: iso(HOJE), ticker, name, quantity, average_price: avg,
    profit_pct: ret * 100, category, value, price, acc_return: ret,
    twelve_months_return: ret * 0.6, cagr: ret / 2, total_invested: invested,
    type, class: klass,
  }
})

const TOTAL = POSICOES.reduce((sum, p) => sum + p.value, 0)
const SHARE = Object.fromEntries(
  PORTFOLIOS[0].custom_categories.map(({ name }) => [
    name,
    POSICOES.filter((p) => p.category === name).reduce((s, p) => s + p.value, 0) / TOTAL,
  ]),
)

const growth = (w: (typeof WEEKS)[number]) => (0.5 + 0.5 * w.t) * (1 + w.dip) + w.wave * w.t
const PATRIMONIO = WEEKS.map((w) => {
  const portfolio = TOTAL * growth(w) / growth(WEEKS[WEEKS.length - 1])
  return {
    date: w.date,
    portfolio,
    aported: w.i % 4 === 0 ? 2500 : 0,
    ...Object.fromEntries(Object.entries(SHARE).map(([k, s]) => [k, portfolio * s])),
  }
})

const RETORNOS = WEEKS.map((w) => ({
  date: w.date, daily_return: 0.001, acc_return: (1 + 0.34 * w.t) * (1 + w.dip) - 1 + w.wave * w.t, cagr: w.i ? 0.16 : null,
}))

const CATEGORY_RETURNS = PORTFOLIOS[0].custom_categories.flatMap(({ id, name }, k) =>
  WEEKS.map((w) => ({
    date: w.date, custom_category_id: id, category: name, daily_return: 0.001,
    acc_return: [0.41, 0.12, 0.47, 0.22][k] * w.t + w.wave * w.t * (k % 2 ? 0.5 : 1.3),
    cagr: w.i ? 0.1 : null,
  })),
)

const PROVENTOS = WEEKS.filter((w) => w.i % 3 === 0).map((w, n) => {
  const p = POSICOES[n % 5]
  return { id: n + 1, asset_id: p.asset_id, date: w.date, ticker: p.ticker, amount: 180 + (n % 7) * 45, category: p.category, portfolio_id: 1 }
})

const CDI = WEEKS.map((w) => ({ date: w.date, value: 0.24 * w.t }))

/* Drawdown tirado da própria curva de rentabilidade: a queda desde o último
   topo, semana a semana. */
let peak = 1
const DRAWDOWN = RETORNOS.map(({ date, acc_return }) => {
  peak = Math.max(peak, 1 + acc_return)
  return { date, drawdown: (1 + acc_return) / peak - 1 }
})
const WORST = DRAWDOWN.reduce((a, b) => (b.drawdown < a.drawdown ? b : a))
const RECOVERY = DRAWDOWN.find((d) => d.date > WORST.date && d.drawdown === 0)
const PEAK = DRAWDOWN.filter((d) => d.date < WORST.date && d.drawdown === 0).at(-1)
const days = (a: string, b: string) => Math.round((+new Date(b) - +new Date(a)) / 86_400_000)

const ANALYSIS = {
  start_date: iso(INICIO),
  performance_metrics: {
    cagr: 0.16,
    benchmarks_metrics: {
      CDI: { cagr: 11, alpha: 5, beta: 0.04, correlation: 0.06 },
      IBOV: { cagr: 9.2, alpha: 6.8, beta: 0.71, correlation: 0.78 },
    },
  },
  risk_metrics: {
    annualized_vol: 0.112, sharpe_ratio: 1.12, semideviation: 0.074,
    skewness: -0.21, kurtosis: 3.6, var_95: -0.0118, cvar_95: -0.0171,
    drawdown: {
      series: DRAWDOWN,
      stats: {
        max_drawdown: WORST.drawdown, max_drawdown_date: WORST.date,
        peak_date_before_max_dd: PEAK?.date ?? iso(INICIO),
        recovery_date: RECOVERY?.date ?? null,
        recovery_days: RECOVERY ? days(WORST.date, RECOVERY.date) : null,
        max_drawdown_duration_days: RECOVERY && PEAK ? days(PEAK.date, RECOVERY.date) : null,
      },
    },
  },
  rolling_cagr: [],
}

/** Alvo de cada categoria, em %; dentro dela, os ativos dividem igual. */
const TARGETS: Record<string, number> = { 'Ações': 30, FIIs: 20, Exterior: 25, 'Renda Fixa': 25 }
const REBALANCEAMENTO = {
  portfolio_id: 1,
  total_value: TOTAL,
  categories: PORTFOLIOS[0].custom_categories.map(({ id, name, color }) => {
    const assets = POSICOES.filter((p) => p.category === name)
    const current = assets.reduce((sum, p) => sum + p.value, 0)
    const target = (TOTAL * TARGETS[name]) / 100
    return {
      category_id: id, category_name: name, color,
      current_value: current, current_pct: (current / TOTAL) * 100,
      target_pct: TARGETS[name], target_value: target,
      diff_pct: TARGETS[name] - (current / TOTAL) * 100, diff_value: target - current,
      assets: assets.map((p) => {
        const pct = (p.value / current) * 100
        const targetPct = 100 / assets.length
        const targetValue = (target * targetPct) / 100
        return {
          asset_id: p.asset_id, ticker: p.ticker, name: p.name, category: name,
          category_id: id, current_value: p.value, current_pct_in_category: pct,
          target_pct_in_category: targetPct, target_value: targetValue,
          diff_pct: targetPct - pct, diff_value: targetValue - p.value,
        }
      }),
    }
  }),
}

test('vídeo da tela de login', async ({ page, mockApi }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme-mode', 'dark')
    localStorage.setItem('theme-dark-id', 'petroleo')
  })
  await page.clock.setFixedTime(HOJE)

  page.on('response', (r) => {
    if (r.status() === 404) console.warn('endpoint sem mock no vídeo:', new URL(r.url()).pathname)
  })

  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1', POSICOES)
  await mockApi('/portfolio/position/1/patrimony_evolution', PATRIMONIO)
  await mockApi('/portfolio/dividend', PROVENTOS)
  await mockApi('/portfolio/transaction', [])
  await mockApi('/portfolio/position/1/returns', RETORNOS)
  await mockApi('/portfolio/position/1/category/returns', CATEGORY_RETURNS)
  await mockApi('/portfolio/position/1/analysis', ANALYSIS)
  await mockApi('/portfolio/rebalancing/1', REBALANCEAMENTO)
  await mockApi('/market_data/series/time_series', { CDI })
  await mockApi('/portfolio/wealth_tier/status/1', {
    portfolio_id: 1,
    patrimony: TOTAL,
    current_tier: { id: 4, rank: 4, name: 'Acumulador', threshold: 250000, artwork: null, artwork_offset: 0, artwork_height: null },
    next_tier: { id: 5, rank: 5, name: 'Patrimonialista', threshold: 500000, artwork: null, artwork_offset: 0, artwork_height: null },
    progress: (TOTAL - 250000) / 250000,
    remaining: 500000 - TOTAL,
  })

  await mockApi('/portfolio/position/1/contribution-average', { monthly_average: 2700 })
  await mockApi('/market_data/asset/favorites', [])
  await mockApi('/portfolio/position/1/consolidation', {
    consolidated_at: HOJE.toISOString(), status: 'success', error: null,
  })

  /* O vídeo começa com o browser; o dev server compilando dá segundos de tela
     branca. O instante em que a tela fica pronta sai no log e o corte é feito
     em cima dele. */
  const started = Date.now()
  /* Espera o gráfico, e não um texto: "Ações" casa com "Ações/ETFs BR" do
     menu, que aparece antes do dado, e o vídeo abriria no esqueleto. */
  const chart = page.locator('.recharts-surface').first()
  await page.goto('/portfolio/overview')
  await chart.waitFor()
  await page.waitForTimeout(1500)
  const start = (Date.now() - started) / 1000

  // Percorre o gráfico de rentabilidade: o tooltip acompanha o cursor.
  const box = await chart.boundingBox()
  if (box) {
    for (let x = 0.08; x <= 0.96; x += 0.02) {
      await page.mouse.move(box.x + box.width * x, box.y + box.height * 0.5)
      await page.waitForTimeout(60)
    }
  }
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: 'Ativo', exact: true }).click()
  await page.waitForTimeout(1800)
  await page.getByRole('tab', { name: 'Patrimônio' }).click()
  await page.waitForTimeout(2200)

  await page.getByRole('button', { name: 'Distribuição', exact: true }).click()
  await page.waitForTimeout(3500)
  await page.getByRole('button', { name: 'Risco', exact: true }).click()
  await page.waitForTimeout(3500)
  /* Volta ao quadro de abertura, com o gráfico já desenhado: o vídeo roda em
     loop e o fim tem de emendar no começo. */
  await page.getByRole('button', { name: 'Resumo', exact: true }).click()
  await chart.waitFor()
  await page.waitForTimeout(2500)
  const end = (Date.now() - started) / 1000

  /* `scripts/cut-reel.mjs` lê isto para cortar o vídeo. */
  writeFileSync(testInfo.outputPath('cut.json'), JSON.stringify({ start, end }))
})
