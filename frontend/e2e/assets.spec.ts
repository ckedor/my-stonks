import { expect, expectNothingClipped, test } from './fixtures/app'

/* Ativos em carteira: a listagem agrupada por categoria e a mesma lista em
   cards. Snapshot antes da migração, como nas outras telas. */

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

test.use({ viewport: { width: 1440, height: 1100 } })

async function abrirListagem(page: import('@playwright/test').Page, mockApi: (path: string, body: unknown) => Promise<void>) {
  await page.clock.setFixedTime(HOJE)
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1', POSICOES)
  await mockApi('/portfolio/dividend', [])
  await mockApi('/portfolio/transaction', [])
  await mockApi('/portfolio/position/1/returns', [])
  await mockApi('/portfolio/position/1/category/returns', [])
  await mockApi('/portfolio/position/1/patrimony_evolution', [])
  await page.goto('/portfolio/asset')
  await expect(page.getByText('PETR4')).toBeVisible()
}

test('portfolio/ativos — lista', async ({ page, mockApi }) => {
  await abrirListagem(page, mockApi)

  await expectNothingClipped(page)
  await expect(page).toHaveScreenshot('page-assets-list.png')
})

test('portfolio/ativos — cards', async ({ page, mockApi }) => {
  /* A escolha entre lista e cards é lida do armazenamento na primeira
     pintura, então ela é semeada antes de a tela abrir. */
  await page.addInitScript(() => {
    localStorage.setItem('my-stonks:asset-list-view', 'card')
  })
  await abrirListagem(page, mockApi)

  await expect(page.getByText('Petrobras PN')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-assets-cards.png')
})
