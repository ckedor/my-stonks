import { expect, expectNothingClipped, test } from './fixtures/app'

/* As telas de Integrações: o painel, a consolidação e uma ingestão. As duas
   últimas abrem com a faixa de agenda, que lê o mesmo painel. */

const PORTFOLIOS = [
  { id: 1, name: 'Principal', user_id: 1 },
  { id: 2, name: 'Reserva', user_id: 2 },
]

const USERS = [
  { id: 1, username: 'ana', email: 'ana@my-stonks.test' },
  { id: 2, username: 'bruno', email: 'bruno@my-stonks.test' },
]

const RUN = {
  id: 41,
  task_name: 'consolidate_all_portfolios',
  routine_key: 'portfolio_consolidation',
  routine_name: 'Consolidação das carteiras',
  trigger: 'scheduled',
  status: 'success',
  started_at: '2026-08-14T15:30:00Z',
  finished_at: '2026-08-14T15:30:04Z',
  duration_seconds: 4,
  arguments: { args: [], kwargs: {} },
  result: null,
  error: null,
}

const schedule = (description: string, frequency: string, next: string) => [
  {
    entry: description,
    task: 'task',
    description,
    frequency,
    next_runs: [next],
    previous_run_at: '2026-08-14T15:30:00Z',
  },
]

const routine = (fields: Record<string, unknown>) => ({
  group: 'market_data',
  description: 'Descrição da rotina.',
  manual: 'task',
  ingestion_type: null,
  tasks: [],
  schedules: [],
  frequency: 'on_demand',
  next_run_at: null,
  last_run: null,
  health: 'on_demand',
  ...fields,
})

const DASHBOARD = {
  generated_at: '2026-08-14T15:50:00Z',
  timezone: 'America/Sao_Paulo',
  summary: {
    routines: 4,
    scheduled_routines: 3,
    running: 0,
    attention: 1,
    runs_last_day: 12,
    failures_last_day: 1,
    failures_last_week: 2,
    next_run_at: '2026-08-14T16:00:00Z',
  },
  routines: [
    routine({
      key: 'quotes',
      name: 'Cotações',
      manual: 'ingestion',
      ingestion_type: 'quote',
      schedules: schedule('Todo dia às 06:15, 12:15 e 18:15', 'intraday', '2026-08-14T21:15:00Z'),
      frequency: 'intraday',
      next_run_at: '2026-08-14T21:15:00Z',
      health: 'ok',
      last_run: { ...RUN, task_name: 'ingest_quotes_for_held_assets', children: {}, execution: null },
    }),
    routine({
      key: 'portfolio_consolidation',
      name: 'Consolidação das carteiras',
      group: 'portfolios',
      schedules: schedule('Todo dia às 06:30, 12:30 e 18:30', 'intraday', '2026-08-14T21:30:00Z'),
      frequency: 'intraday',
      next_run_at: '2026-08-14T21:30:00Z',
      health: 'warning',
      last_run: { ...RUN, children: { success: 1, failure: 1 }, execution: null },
    }),
    routine({
      key: 'fund_registry',
      name: 'Cadastro de fundos (CVM)',
      group: 'reference_data',
      manual: 'ingestion',
      ingestion_type: 'fund_registry',
      schedules: schedule('Toda terça às 09:00', 'weekly', '2026-08-18T12:00:00Z'),
      frequency: 'weekly',
      next_run_at: '2026-08-18T12:00:00Z',
      health: 'ok',
      last_run: { ...RUN, task_name: 'ingest_fund_registry', children: {}, execution: null },
    }),
    routine({
      key: 'asset_catalogue',
      name: 'Catálogo de ativos',
      group: 'reference_data',
      manual: 'screen',
    }),
  ],
  upcoming: [
    {
      routine_key: 'quotes',
      routine_name: 'Cotações',
      at: '2026-08-14T21:15:00Z',
      schedule: 'Todo dia às 06:15, 12:15 e 18:15',
    },
  ],
  recent_runs: [RUN],
}

const ASSETS = [
  { id: 1, ticker: 'PETR4', name: 'Petrobras PN' },
  { id: 2, ticker: 'HGLG11', name: 'CSHG Logística' },
]

test('admin/integrations', async ({ page, mockApi }) => {
  await mockApi('/operations/dashboard', DASHBOARD)

  await page.goto('/admin/integrations')

  await expect(page.getByRole('heading', { name: 'Painel', exact: true })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-integrations.png')
})

test('admin/consolidation', async ({ page, mockApi }) => {
  await mockApi('/operations/dashboard', DASHBOARD)
  await mockApi('/portfolio/all', PORTFOLIOS)
  await mockApi('/users', USERS)
  await mockApi('/market_data/asset', ASSETS)

  await page.goto('/admin/integrations/consolidation')

  await expect(
    page.getByRole('heading', { name: 'Consolidação das carteiras', exact: true }),
  ).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-consolidation.png')
})

test('admin/quote-ingestion', async ({ page, mockApi }) => {
  await mockApi('/operations/dashboard', DASHBOARD)
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

  await page.goto('/admin/integrations/quotes')

  await expect(page.getByRole('heading', { name: 'Cotações', exact: true })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-quote-ingestion.png')
})
