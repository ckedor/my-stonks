import { expect, expectNothingClipped, test } from './fixtures/app'

/* Configurações: a grade de temas e as integrações. Criar tema é do admin,
   no estúdio do design system. */

const PORTFOLIOS = [
  { id: 1, name: 'Principal', user_id: 1, custom_categories: [] },
]

async function abrirConfiguracoes(
  page: import('@playwright/test').Page,
  mockApi: (path: string, body: unknown) => Promise<void>,
) {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1', [])
  await mockApi('/portfolio/dividend', [])
  await mockApi('/portfolio/transaction', [])
  await mockApi('/portfolio/user_configuration/1', {
    configurations: [{ id: 1, portfolio_id: 1, name: 'fiis_dividends_integration', enabled: true }],
    nameOptions: ['foxbit_integration', 'fiis_dividends_integration', 'wealth_tier_artwork'],
  })
  await page.goto('/portfolio/user-configurations')
}

test.use({ viewport: { width: 1440, height: 2000 } })

test('configurações — temas', async ({ page, mockApi }) => {
  await abrirConfiguracoes(page, mockApi)

  await expect(page.getByRole('heading', { name: 'Tema Claro' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-settings-themes.png')
})

test('configurações — integrações', async ({ page, mockApi }) => {
  await abrirConfiguracoes(page, mockApi)

  await page.getByRole('tab', { name: 'Integrações' }).click()
  await expect(page.getByText('Dividendos de FIIs')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-settings-integrations.png')
})
