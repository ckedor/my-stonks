import { expect, expectNothingClipped, test } from './fixtures/app'

/* Os quatro formulários que a barra superior abre. Todos são drawers à
   direita com o mesmo esqueleto — título, campos e um botão de largura
   inteira no rodapé — e é essa repetição que a migração vai colapsar.

   Como nas outras telas, os snapshots nascem antes da migração. */

const PORTFOLIOS = [
  {
    id: 1,
    name: 'Principal',
    user_id: 1,
    custom_categories: [
      { id: 10, name: 'Renda Fixa', color: '#1976d2', benchmark_id: 3, portfolio_id: 1 },
      { id: 11, name: 'Ações', color: '#2e7d32', benchmark_id: null, portfolio_id: 1 },
    ],
  },
  { id: 2, name: 'Reserva', user_id: 1, custom_categories: [] },
]

const BENCHMARKS = [
  { id: 3, short_name: 'CDI' },
  { id: 4, short_name: 'IBOV' },
  { id: 5, short_name: 'IPCA' },
]

const ASSET_TYPES = [
  { id: 1, short_name: 'Ação', asset_class_id: 2 },
  { id: 2, short_name: 'FII', asset_class_id: 2 },
  { id: 3, short_name: 'CDB', asset_class_id: 1 },
]

const ASSETS = [
  { id: 1, ticker: 'PETR4', name: 'Petrobras PN', asset_type_id: 1 },
  { id: 2, ticker: 'HGLG11', name: 'CSHG Logística', asset_type_id: 2 },
]

const FIXED_INCOME_TYPES = [
  { id: 1, name: 'Pré', description: 'taxa fixa' },
  { id: 2, name: 'Índice +', description: 'índice mais taxa' },
]

const BROKERS = [
  { id: 1, name: 'Rico', legalId: '1', currency: { id: 1, name: 'Real', code: 'BRL' } },
  { id: 2, name: 'Avenue', legalId: '2', currency: { id: 2, name: 'Dólar', code: 'USD' } },
]

test.use({ viewport: { width: 1440, height: 1000 } })

/* Dois destes formulários abrem com a data de hoje preenchida, e um
   snapshot que muda de valor sozinho todo dia é um snapshot que se aprende
   a ignorar. O relógio fica parado num dia qualquer, fixo. */
const HOJE = new Date('2026-03-17T12:00:00-03:00')

async function openApp(page: import('@playwright/test').Page) {
  await page.clock.setFixedTime(HOJE)
  await page.goto('/portfolio/overview')
  await expect(page.getByRole('button', { name: 'Principal' })).toBeVisible()
}

test('formulário de carteira — nova', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/series', BENCHMARKS)

  await openApp(page)
  await page.getByRole('button', { name: 'Principal' }).click()
  await page.getByRole('menuitem', { name: 'Nova carteira' }).click()

  await expect(page.getByRole('heading', { name: 'Nova Carteira' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar Carteira' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('form-portfolio-new.png')
})

test('formulário de carteira — edição', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/series', BENCHMARKS)

  await openApp(page)
  await page.getByRole('button', { name: 'Principal' }).click()
  await page.getByRole('menuitem', { name: 'Editar carteira' }).click()

  await expect(page.getByRole('heading', { name: 'Editar Carteira' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salvar Alterações' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('form-portfolio-edit.png')
})

test('formulário de carteira — confirmar exclusão da carteira', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/series', BENCHMARKS)

  await openApp(page)
  await page.getByRole('button', { name: 'Principal' }).click()
  await page.getByRole('menuitem', { name: 'Editar carteira' }).click()
  await page.getByRole('button', { name: 'Excluir carteira' }).click()

  await expect(page.getByRole('heading', { name: 'Confirmar Exclusão' })).toBeVisible()

  await expect(page).toHaveScreenshot('form-portfolio-confirm-delete.png')
})

test('formulário de carteira — confirmar exclusão de categoria', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/series', BENCHMARKS)

  await openApp(page)
  await page.getByRole('button', { name: 'Principal' }).click()
  await page.getByRole('menuitem', { name: 'Editar carteira' }).click()
  await page.getByRole('button', { name: 'Excluir categoria Ações' }).click()

  await expect(page.getByRole('heading', { name: 'Confirmar Exclusão' })).toBeVisible()

  await expect(page).toHaveScreenshot('form-category-confirm-delete.png')
})

test('formulário de categorias', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/series', BENCHMARKS)

  await openApp(page)
  await page.getByRole('button', { name: 'Ações rápidas' }).click()
  await page.getByRole('menuitem', { name: 'Editar Categorias' }).click()

  await expect(page.getByRole('heading', { name: /Editar Categorias/ })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('form-categories.png')
})

test('formulário de provento', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/asset/type', ASSET_TYPES)
  await mockApi('/market_data/asset', ASSETS)

  await openApp(page)
  await page.getByRole('button', { name: 'Ações rápidas' }).click()
  await page.getByRole('menuitem', { name: 'Cadastrar Dividendo' }).click()

  await expect(page.getByRole('heading', { name: 'Novo Provento' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cadastrar' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('form-dividend.png')
})

test('formulário de negociação', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/asset/type', ASSET_TYPES)
  await mockApi('/market_data/asset', ASSETS)
  await mockApi('/market_data/broker', BROKERS)

  await openApp(page)
  await page.getByRole('button', { name: 'Ações rápidas' }).click()
  await page.getByRole('menuitem', { name: 'Comprar Ativo' }).click()

  await expect(page.getByRole('heading', { name: 'Nova Negociação' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cadastrar' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('form-trade.png')
})

test('formulário de ativo de renda fixa', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/asset/type', ASSET_TYPES)
  await mockApi('/market_data/asset', ASSETS)
  await mockApi('/market_data/broker', BROKERS)
  await mockApi('/market_data/asset/fixed_income/type', FIXED_INCOME_TYPES)
  await mockApi('/market_data/series', BENCHMARKS)

  await openApp(page)
  await page.getByRole('button', { name: 'Ações rápidas' }).click()
  await page.getByRole('menuitem', { name: 'Comprar Ativo' }).click()
  await expect(page.getByRole('heading', { name: 'Nova Negociação' })).toBeVisible()

  /* O atalho de criar só aparece quando o tipo escolhido é de renda fixa:
     é ali que um ativo pode não existir ainda no cadastro. */
  await page.getByRole('combobox', { name: 'Tipo de Ativo' }).click()
  await page.getByRole('option', { name: 'CDB' }).click()
  await page.getByRole('combobox', { name: 'Ativo', exact: true }).click()
  await page.getByText('Novo ativo de renda fixa…').click()

  await expect(page.getByRole('heading', { name: 'Novo Ativo de Renda Fixa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar ativo' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('form-fixed-income.png')
})
