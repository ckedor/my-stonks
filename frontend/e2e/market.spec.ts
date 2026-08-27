import { expect, expectNothingClipped, test } from './fixtures/app'

/* Mercado: a listagem de ativos (cards e lista) e a visão geral. */

const ATIVOS = [
  {
    id: 1, ticker: 'PETR4', name: 'Petrobras PN', asset_type_id: 1,
    asset_type: { id: 1, short_name: 'Ação', name: 'Ação', asset_class_id: 1 },
  },
  {
    id: 2, ticker: 'HGLG11', name: 'CSHG Logística FII', asset_type_id: 2,
    asset_type: { id: 2, short_name: 'FII', name: 'Fundo Imobiliário', asset_class_id: 1 },
  },
  {
    id: 3, ticker: 'BOVA11', name: 'iShares Ibovespa', asset_type_id: 3,
    asset_type: { id: 3, short_name: 'ETF', name: 'Exchange Traded Fund', asset_class_id: 1 },
  },
]

const TIPOS = [
  { id: 1, short_name: 'Ação', name: 'Ação', asset_class_id: 1, asset_class: { id: 1, name: 'Renda Variável' } },
  { id: 2, short_name: 'FII', name: 'Fundo Imobiliário', asset_class_id: 1, asset_class: { id: 1, name: 'Renda Variável' } },
  { id: 3, short_name: 'ETF', name: 'Exchange Traded Fund', asset_class_id: 1, asset_class: { id: 1, name: 'Renda Variável' } },
]

async function abrirListagem(
  page: import('@playwright/test').Page,
  mockApi: (path: string, body: unknown) => Promise<void>,
) {
  await mockApi('/portfolio', [{ id: 1, name: 'Principal', user_id: 1, custom_categories: [] }])
  await mockApi('/portfolio/position/1', [])
  await mockApi('/market_data/asset', ATIVOS)
  await mockApi('/market_data/asset/type', TIPOS)
  await mockApi('/market_data/asset/favorites', [])
  await page.goto('/market/assets')
  await expect(page.getByText('PETR4')).toBeVisible()
}

test.use({ viewport: { width: 1440, height: 1000 } })

test('market/ativos — cards', async ({ page, mockApi }) => {
  await abrirListagem(page, mockApi)

  await expectNothingClipped(page)
  await expect(page).toHaveScreenshot('page-market-assets.png')
})

test('market/ativos — lista', async ({ page, mockApi }) => {
  await page.addInitScript(() => {
    localStorage.setItem('my-stonks:market:view-mode', 'list')
  })
  await abrirListagem(page, mockApi)

  await expectNothingClipped(page)
  await expect(page).toHaveScreenshot('page-market-assets-list.png')
})

test('market/visão geral', async ({ page, mockApi }) => {
  await mockApi('/portfolio', [{ id: 1, name: 'Principal', user_id: 1, custom_categories: [] }])
  await mockApi('/portfolio/position/1', [])

  await page.goto('/market/overview')
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible()

  await expect(page).toHaveScreenshot('page-market-overview.png')
})
