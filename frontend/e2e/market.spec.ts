import { expect, expectNothingClipped, test } from './fixtures/app'
import { ETF_READINGS, FII_MARKET, MARKET_CATALOGUES } from './fixtures/market-catalogue'
import { WORLD_READINGS } from './fixtures/world-readings'

/* Mercado: a tela de ativos (destaques, screener e o cadastro) e a visão
   geral. */

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

async function abrirAtivos(
  page: import('@playwright/test').Page,
  mockApi: (path: string, body: unknown) => Promise<void>,
) {
  await mockApi('/portfolio', [{ id: 1, name: 'Principal', user_id: 1, custom_categories: [] }])
  await mockApi('/portfolio/position/1', [])
  await mockApi('/market_data/asset', ATIVOS)
  await mockApi('/market_data/asset/type', TIPOS)
  await mockApi('/market_data/asset/favorites', [])
  await mockApi('/market_data/fii/market', FII_MARKET)
  await mockApi('/market_data/readings/etfs', ETF_READINGS)
  for (const [kind, body] of Object.entries(MARKET_CATALOGUES)) {
    await mockApi(`/market_data/market/${kind}`, body)
  }
  await page.goto('/market/assets')
  await expect(page.getByText('Os maiores de cada categoria')).toBeVisible()
}

test.describe('market/ativos', () => {
  // A tela inteira: destaques, mapa e o screener embaixo.
  test.use({ viewport: { width: 1440, height: 2400 } })

  test('carteira, principais e ETFs mundiais', async ({ page, mockApi }) => {
    await abrirAtivos(page, mockApi)

    await expectNothingClipped(page)
    await expect(page).toHaveScreenshot('page-market-assets.png')
  })

  test('screener de FIIs', async ({ page, mockApi }) => {
    await abrirAtivos(page, mockApi)
    await page.getByRole('tab', { name: 'FIIs' }).click()
    await expect(page.getByText('Logística').first()).toBeVisible()

    await expectNothingClipped(page)
    await expect(page).toHaveScreenshot('page-market-assets-fii.png')
  })

  test('todo o cadastro', async ({ page, mockApi }) => {
    await abrirAtivos(page, mockApi)
    await page.getByRole('tab', { name: 'Todo o cadastro' }).click()
    await expect(page.getByText('Petrobras PN').first()).toBeVisible()

    await expectNothingClipped(page)
    await expect(page).toHaveScreenshot('page-market-assets-list.png')
  })
})

test('market/visão geral', async ({ page, mockApi }) => {
  await mockApi('/portfolio', [{ id: 1, name: 'Principal', user_id: 1, custom_categories: [] }])
  await mockApi('/portfolio/position/1', [])

  await mockApi('/market_data/readings/world', WORLD_READINGS)

  await page.goto('/market/overview')
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible()
  await expect(page.getByText('Onde cada mercado está na própria história')).toBeVisible()

  await expect(page).toHaveScreenshot('page-market-overview.png')
})
