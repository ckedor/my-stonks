import { expect, expectNothingClipped, test } from './fixtures/app'

/* As duas telas operacionais do admin: consolidação e ingestão. Como nas
   outras, os snapshots nasceram antes da migração para o design system. */

const PORTFOLIOS = [
  { id: 1, name: 'Principal', user_id: 1 },
  { id: 2, name: 'Reserva', user_id: 2 },
]

const USERS = [
  { id: 1, username: 'ana', email: 'ana@my-stonks.test' },
  { id: 2, username: 'bruno', email: 'bruno@my-stonks.test' },
]

const ASSETS = [
  { id: 1, ticker: 'PETR4', name: 'Petrobras PN' },
  { id: 2, ticker: 'HGLG11', name: 'CSHG Logística' },
]

test('admin/consolidation', async ({ page, mockApi }) => {
  await mockApi('/portfolio/all', PORTFOLIOS)
  await mockApi('/users', USERS)
  await mockApi('/market_data/asset', ASSETS)

  await page.goto('/admin/consolidation')

  await expect(page.getByRole('heading', { name: 'Consolidação', exact: true })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-consolidation.png')
})

test('admin/quote-ingestion', async ({ page, mockApi }) => {
  await mockApi('/market_data/ingestions/quote', [
    {
      id: 7,
      status: 'SUCCESS',
      started_at: '2026-08-14T09:00:00Z',
      finished_at: '2026-08-14T09:04:30Z',
      total_items: 120,
      processed_items: 120,
      failed_items: 0,
    },
    {
      id: 6,
      status: 'FAILED',
      started_at: '2026-08-13T09:00:00Z',
      finished_at: '2026-08-13T09:01:10Z',
      total_items: 120,
      processed_items: 44,
      failed_items: 3,
    },
  ])

  await page.goto('/admin/quote-ingestion')

  await expect(page.getByRole('heading', { name: 'Importação de cotações' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-quote-ingestion.png')
})
