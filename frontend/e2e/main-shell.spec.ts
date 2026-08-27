import { expect, expectNothingClipped, test } from './fixtures/app'

/* A casca do app fora do admin: `MainLayout` e `MainTopbar`.
 *
 * A tela escolhida é `/portfolio/overview` porque, sem dado mockado, ela
 * para no próprio esqueleto — um corpo de página estável e neutro, que deixa
 * o snapshot falar sobre a barra superior e não sobre o conteúdo.
 *
 * A coluna de navegação entra nos dois estados (expandida e recolhida), e os
 * menus e o drawer um a um: são a maior parte do componente e não apareceriam
 * num snapshot só da barra fechada. */

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

test('main shell — coluna recolhida', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)

  await openShell(page)
  await page.getByRole('button', { name: 'Recolher menu' }).click()

  /* Recolhida, o rótulo sai da tela e sobra o ícone — é o que distingue este
     snapshot do primeiro, e checar isso aqui é o que faz o teste falhar se a
     faixa deixar de recolher em vez de só mudar de cor. */
  await expect(page.getByText('Rebalanceamento')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Expandir menu' })).toBeVisible()

  /* Tira o ponteiro e o foco do botão: em qualquer um dos dois o tooltip
     continua aberto e entra no snapshot por cima do primeiro item. */
  await page.mouse.move(700, 500)
  await page.getByRole('button', { name: 'Expandir menu' }).blur()
  await expect(page.getByRole('tooltip')).toBeHidden()

  await expect(page).toHaveScreenshot('main-shell-collapsed.png')
})

test('main shell — a navegação continua na tela ao rolar', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)

  /* O Mercado, e não a Carteira: sem dado mockado a Carteira para no estado
     vazio, que cabe na viewport. Numa tela que não rola, "continua na tela"
     é verdade sozinho e o teste passaria mesmo com a coluna quebrada. */
  await page.goto('/market/overview')
  await expect(page.getByText('Visão geral do mercado')).toBeVisible()

  await page.mouse.wheel(0, 1200)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(600)

  /* O guarda de um bug que não se vê lendo o componente: a coluna declara
     `position: sticky`, mas basta um `overflow` diferente de `visible` em
     qualquer ancestral para o navegador ignorar isso em silêncio. Já
     aconteceu — `overflow-x: hidden` no `body`, em `index.css`, fazia a
     coluna subir junto com o conteúdo. */
  await expect(page.getByRole('button', { name: 'Cripto' })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Carteira', exact: true })).toBeInViewport()
})

test('main shell — a aba da seção leva à primeira página dela', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/asset/favorites', FAVORITES)

  await openShell(page)
  await page.getByRole('button', { name: 'Mercado', exact: true }).click()

  await expect(page).toHaveURL('/market/overview')
})

test('main shell — atalho para a tela de categorias', async ({ page, mockApi }) => {
  await mockApi('/portfolio', [
    {
      ...PORTFOLIOS[0],
      custom_categories: [
        { id: 10, name: 'Ações', color: '#1976d2', benchmark_id: null },
        { id: 11, name: 'FIIs', color: '#2e7d32', benchmark_id: null },
      ],
    },
  ])

  await openShell(page)

  await page.getByText('Categorias', { exact: true }).click()
  /* A tela abre na primeira categoria da carteira, que passa a nomear a URL. */
  await expect(page).toHaveURL('/portfolio/category/10')
})

test('main shell — coluna do Mercado com mais acessados', async ({ page, mockApi }) => {
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
