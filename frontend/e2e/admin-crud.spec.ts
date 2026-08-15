import { expect, expectNothingClipped, test } from './fixtures/app'

/* As quatro telas de CRUD do admin, todas migradas para o design system na
   mesma leva. Os snapshots foram gerados a partir do código ANTERIOR à
   migração: eles existem justamente para provar que trocar `<Box>`/`<Stack>`
   por `AppStack` e o `<Dialog>` por `AppConfirmDialog` não mexeu em pixel
   nenhum. Se um destes falhar depois de uma migração, a migração mudou o
   visual. */

const CURRENCIES = [
  { id: 1, name: 'Real', code: 'BRL' },
  { id: 2, name: 'Dólar', code: 'USD' },
]

const BROKERS = [
  { id: 1, name: 'Corretora Alfa', cnpj: '11.111.111/0001-11', currency: CURRENCIES[0], currency_id: 1 },
  { id: 2, name: 'Corretora Beta', cnpj: null, currency: CURRENCIES[1], currency_id: 2 },
]

const ASSET_TYPES = [
  { id: 1, name: 'Ação' },
  { id: 2, name: 'FII' },
]

const ASSETS = [
  { id: 1, ticker: 'PETR4', name: 'Petrobras PN', asset_type: ASSET_TYPES[0], asset_type_id: 1, exchange_id: 1 },
  { id: 2, ticker: 'HGLG11', name: 'CSHG Logística', asset_type: ASSET_TYPES[1], asset_type_id: 2, exchange_id: 1 },
]

const EVENTS = [
  { id: 1, asset_id: 1, type: 'SPLIT', date: '2026-03-10', factor: 2 },
  { id: 2, asset_id: 2, type: 'BONUS', date: '2026-04-22', factor: 1.05 },
]

const AI_FEATURES = [
  {
    id: 1,
    key: 'asset_overview',
    default_ttl_hours: 24,
    created_at: '2026-01-15T10:30:00Z',
    updated_at: '2026-02-20T14:00:00Z',
  },
]

test('admin/brokers — listagem', async ({ page, mockApi }) => {
  await mockApi('/market_data/broker', BROKERS)
  await mockApi('/market_data/currency', CURRENCIES)

  await page.goto('/admin/brokers')

  await expect(page.getByRole('heading', { name: 'Gerenciamento de Corretoras' })).toBeVisible()
  await expect(page.getByText('Corretora Alfa')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-brokers.png')
})

test('admin/events — listagem', async ({ page, mockApi }) => {
  await mockApi('/market_data/asset/event', EVENTS)
  await mockApi('/market_data/asset', ASSETS)

  await page.goto('/admin/events')

  await expect(page.getByRole('heading', { name: 'Gerenciamento de Eventos' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-events.png')
})

test('admin/assets — listagem', async ({ page, mockApi }) => {
  await mockApi('/market_data/asset', ASSETS)
  await mockApi('/market_data/asset/type', ASSET_TYPES)
  await mockApi('/market_data/asset/exchange', [{ id: 1, name: 'B3' }])
  await mockApi('/market_data/asset/fii/segment', [{ id: 1, name: 'Logística' }])
  await mockApi('/market_data/asset/etf/segment', [{ id: 1, name: 'Índice' }])
  await mockApi('/market_data/asset/fixed_income/type', [{ id: 1, name: 'CDB' }])
  await mockApi('/market_data/asset/treasury_bond/type', [{ id: 1, name: 'Selic' }])
  await mockApi('/market_data/asset/index', [{ id: 1, name: 'IBOVESPA' }])

  await page.goto('/admin/assets')

  await expect(page.getByRole('heading', { name: 'Gerenciamento de Ativos' })).toBeVisible()
  await expect(page.getByText('Petrobras PN')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-assets.png')
})

test('admin/ai-features — listagem', async ({ page, mockApi }) => {
  await mockApi('/ai/feature', AI_FEATURES)

  await page.goto('/admin/ai-features')

  await expect(page.getByRole('heading', { name: 'AI Features' })).toBeVisible()
  await expect(page.getByText('asset_overview')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-ai-features.png')
})

/* O formulário só aparece ao abrir o drawer, então nenhum snapshot de
   listagem o cobria. Esta referência nasceu antes de o `CrudForm` virar
   componente do design system. */
test('admin/users — formulário de criação', async ({ page, mockApi }) => {
  await mockApi('/users', [])

  await page.goto('/admin/users')
  await page.getByRole('button', { name: 'Novo Usuário' }).click()

  await expect(page.getByRole('heading', { name: 'Novo Usuário' })).toBeVisible()

  await expect(page).toHaveScreenshot('admin-users-form.png')
})
