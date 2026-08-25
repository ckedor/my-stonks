import { expect, expectNothingClipped, test } from './fixtures/app'

/* A visão geral: patrimônio e patente no topo, rentabilidade e pizza na
   primeira linha, lista de categorias e a aba de proventos/patrimônio/aportes
   na segunda. Como nas outras telas, o snapshot nasce antes da migração. */

const HOJE = new Date('2026-03-17T12:00:00-03:00')

const PORTFOLIOS = [
  {
    id: 1,
    name: 'Principal',
    user_id: 1,
    custom_categories: [
      { id: 10, name: 'Ações', color: '#1976d2', benchmark_id: null },
      { id: 11, name: 'FIIs', color: '#2e7d32', benchmark_id: null },
    ],
  },
]

const POSICOES = [
  {
    asset_id: 1, date: '2026-03-17', ticker: 'PETR4', name: 'Petrobras PN',
    quantity: 300, average_price: 32.4, profit_pct: 41.98, category: 'Ações',
    value: 13800, price: 46, acc_return: 0.4198, twelve_months_return: 0.1903,
    cagr: 0.1832, total_invested: 9720, type: 'Ação', class: 'Renda Variável',
  },
  {
    asset_id: 2, date: '2026-03-17', ticker: 'HGLG11', name: 'CSHG Logística',
    quantity: 90, average_price: 152.1, profit_pct: -4.2, category: 'FIIs',
    value: 13113, price: 145.7, acc_return: -0.042, twelve_months_return: 0.061,
    cagr: 0.074, total_invested: 13689, type: 'FII', class: 'Renda Variável',
  },
  {
    asset_id: 3, date: '2026-03-17', ticker: 'BOVA11', name: 'iShares Ibovespa',
    quantity: 40, average_price: 108.5, profit_pct: 12.4, category: 'Ações',
    value: 4877, price: 121.9, acc_return: 0.124, twelve_months_return: 0.088,
    cagr: 0.095, total_invested: 4340, type: 'ETF', class: 'Renda Variável',
  },
]

const PATRIMONIO = [
  { date: '2025-03-17', portfolio: 24000, aported: 24000, 'Ações': 14000, FIIs: 10000 },
  { date: '2025-09-17', portfolio: 27500, aported: 1500, 'Ações': 16000, FIIs: 11500 },
  { date: '2026-03-17', portfolio: 31790, aported: 300, 'Ações': 18677, FIIs: 13113 },
]

const PROVENTOS = [
  { id: 1, asset_id: 1, date: '2025-05-14', ticker: 'PETR4', amount: 120.5, category: 'Ações', portfolio_id: 1 },
  { id: 2, asset_id: 2, date: '2025-08-20', ticker: 'HGLG11', amount: 88.3, category: 'FIIs', portfolio_id: 1 },
  { id: 3, asset_id: 1, date: '2026-02-13', ticker: 'PETR4', amount: 165.9, category: 'Ações', portfolio_id: 1 },
]

async function mockOverview(mockApi: (path: string, body: unknown) => Promise<void>) {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1', POSICOES)
  await mockApi('/portfolio/position/1/patrimony_evolution', PATRIMONIO)
  await mockApi('/portfolio/dividend', PROVENTOS)
  await mockApi('/portfolio/transaction', [])
  await mockApi('/portfolio/position/1/returns', [
    { date: '2025-03-17', daily_return: 0, acc_return: 0, cagr: null },
    { date: '2025-09-17', daily_return: 0.002, acc_return: 0.11, cagr: 0.23 },
    { date: '2026-03-17', daily_return: 0.001, acc_return: 0.21, cagr: 0.21 },
  ])
  await mockApi('/portfolio/position/1/category/returns', [
    { date: '2025-03-17', custom_category_id: 10, category: 'Ações', daily_return: 0, acc_return: 0, cagr: null },
    { date: '2026-03-17', custom_category_id: 10, category: 'Ações', daily_return: 0.001, acc_return: 0.28, cagr: 0.28 },
    { date: '2025-03-17', custom_category_id: 11, category: 'FIIs', daily_return: 0, acc_return: 0, cagr: null },
    { date: '2026-03-17', custom_category_id: 11, category: 'FIIs', daily_return: -0.001, acc_return: -0.04, cagr: -0.04 },
  ])
  await mockApi('/portfolio/position/1/analysis', {
    start_date: '2025-03-17',
    performance_metrics: {
      cagr: 0.21,
      benchmarks_metrics: { CDI: { cagr: 12, alpha: 9, beta: 0.3, correlation: 0.1 } },
    },
    risk_metrics: null,
    rolling_cagr: [],
  })
  await mockApi('/market_data/series/time_series', {
    CDI: [
      { date: '2025-03-17', value: 0 },
      { date: '2025-09-17', value: 0.06 },
      { date: '2026-03-17', value: 0.12 },
    ],
  })
  await mockApi('/portfolio/wealth_tier/status/1', {
    portfolio_id: 1,
    patrimony: 31790,
    current_tier: { id: 2, rank: 2, name: 'Investidor', threshold: 25000, artwork: null, artwork_offset: 0, artwork_height: null },
    next_tier: { id: 3, rank: 3, name: 'Acumulador', threshold: 50000, artwork: null, artwork_offset: 0, artwork_height: null },
    progress: 0.27,
    remaining: 18210,
  })
}

test.use({ viewport: { width: 1440, height: 1300 } })

test('portfolio/visão geral', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await mockOverview(mockApi)

  await page.goto('/portfolio/overview')

  await expect(page.getByText('Investidor')).toBeVisible()
  await expect(page.getByText('Ações').first()).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-overview.png')
})

test('portfolio/visão geral — aba de patrimônio', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await mockOverview(mockApi)

  await page.goto('/portfolio/overview')
  await expect(page.getByText('Ações').first()).toBeVisible()

  await page.getByRole('tab', { name: 'Patrimônio' }).click()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-overview-patrimony.png')
})

test('portfolio/visão geral — carteira vazia', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await mockOverview(mockApi)
  await mockApi('/portfolio/position/1', [])

  await page.goto('/portfolio/overview')

  await expect(page.getByText('Sua carteira ainda está vazia')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-overview-empty.png')
})
