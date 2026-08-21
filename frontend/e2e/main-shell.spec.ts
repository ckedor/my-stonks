import { expect, expectNothingClipped, test } from './fixtures/app'

/* A casca do app fora do admin: `MainLayout` e `MainTopbar`.
 *
 * A tela escolhida é `/portfolio/overview` porque, sem dado mockado, ela
 * para no próprio esqueleto — um corpo de página estável e neutro, que deixa
 * o snapshot falar sobre a barra superior e não sobre o conteúdo.
 *
 * Os estados abertos (mega-menu, menus e drawer) entram um a um: são a maior
 * parte do componente e não apareceriam num snapshot só da barra fechada. */

const PORTFOLIOS = [
  { id: 1, name: 'Principal', user_id: 1 },
  { id: 2, name: 'Reserva', user_id: 1 },
]

const FAVORITES = [
  { id: 11, ticker: 'PETR4', name: 'Petrobras PN', visit_count: 42 },
  { id: 12, ticker: 'HGLG11', name: 'CSHG Logística', visit_count: 31 },
  { id: 13, ticker: 'BOVA11', name: 'iShares Ibovespa', visit_count: 12 },
]

test.use({ viewport: { width: 1440, height: 1000 } })

async function openShell(page: import('@playwright/test').Page) {
  await page.goto('/portfolio/overview')
  await expect(page.getByText('My Stonks')).toBeVisible()
  /* O nome da carteira só aparece depois que `/portfolio/all` responde, e é
     ele que fixa a largura do bloco de ações à direita. */
  await expect(page.getByRole('button', { name: 'Principal' })).toBeVisible()
}

test('main shell — barra superior', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)

  await openShell(page)
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('main-shell.png')
})

test('main shell — mega-menu Carteira', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)

  await openShell(page)
  await page.getByRole('button', { name: 'Carteira', exact: true }).click()
  await expect(page.getByText('Rebalanceamento')).toBeVisible()

  await expect(page).toHaveScreenshot('main-shell-carteira.png')
})

test('main shell — mega-menu Mercado com mais acessados', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/asset/favorites', FAVORITES)

  await openShell(page)
  await page.getByRole('button', { name: 'Mercado', exact: true }).click()
  await expect(page.getByText('Mais acessados')).toBeVisible()
  await expect(page.getByText('BOVA11')).toBeVisible()

  await expect(page).toHaveScreenshot('main-shell-mercado.png')
})

test('main shell — seletor de carteira', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)

  await openShell(page)
  await page.getByRole('button', { name: 'Principal' }).click()
  await expect(page.getByRole('menuitem', { name: 'Nova carteira' })).toBeVisible()

  await expect(page).toHaveScreenshot('main-shell-portfolio-menu.png')
})

test('main shell — menu de ações rápidas', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)

  await openShell(page)
  await page.getByRole('button', { name: 'Ações rápidas' }).click()
  await expect(page.getByRole('menuitem', { name: 'Recalcular Carteira' })).toBeVisible()

  await expect(page).toHaveScreenshot('main-shell-actions-menu.png')
})

test('main shell — menu da conta', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)

  await openShell(page)
  await page.getByRole('button', { name: 'Conta' }).click()
  await expect(page.getByRole('menuitem', { name: 'Admin' })).toBeVisible()

  await expect(page).toHaveScreenshot('main-shell-user-menu.png')
})

test('main shell — drawer no mobile', async ({ page, mockApi }) => {
  await page.setViewportSize({ width: 500, height: 1000 })
  await mockApi('/portfolio', PORTFOLIOS)

  await page.goto('/portfolio/overview')
  await expect(page.getByText('My Stonks').first()).toBeVisible()

  await page.getByRole('button', { name: 'Abrir menu de navegação' }).click()
  await expect(page.getByText('Rebalanceamento')).toBeVisible()

  await expect(page).toHaveScreenshot('main-shell-drawer.png')
})
