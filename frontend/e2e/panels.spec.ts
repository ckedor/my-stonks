import { expect, expectNothingClipped, test } from './fixtures/app'

/* Os painéis de leitura: risco, cabeçalho do ativo e posição.
   Como nas outras telas, os snapshots nascem antes da migração. */

const PORTFOLIOS = [{ id: 1, name: 'Principal', user_id: 1, custom_categories: [] }]

/* Série curta e escrita à mão: um drawdown que cai, fundo, e recupera.
   Dado gerado por laço mudaria de forma a cada ajuste no laço. */
const DRAWDOWN_SERIES = [
  { date: '2025-01-31', drawdown: 0 },
  { date: '2025-02-28', drawdown: -0.032 },
  { date: '2025-03-31', drawdown: -0.075 },
  { date: '2025-04-30', drawdown: -0.121 },
  { date: '2025-05-31', drawdown: -0.184 },
  { date: '2025-06-30', drawdown: -0.142 },
  { date: '2025-07-31', drawdown: -0.09 },
  { date: '2025-08-31', drawdown: -0.041 },
  { date: '2025-09-30', drawdown: 0 },
  { date: '2025-10-31', drawdown: -0.018 },
  { date: '2025-11-30', drawdown: -0.055 },
  { date: '2025-12-31', drawdown: -0.027 },
]

const ANALYSIS = {
  start_date: '2025-01-31',
  performance_metrics: { cagr: 0.1432, benchmarks_metrics: {} },
  risk_metrics: {
    annualized_vol: 0.1873,
    sharpe_ratio: 0.84,
    semideviation: 0.1204,
    skewness: -0.37,
    kurtosis: 4.12,
    var_95: -0.0213,
    cvar_95: -0.0319,
    drawdown: {
      series: DRAWDOWN_SERIES,
      stats: {
        max_drawdown: -0.184,
        max_drawdown_date: '2025-05-31',
        peak_date_before_max_dd: '2025-01-31',
        recovery_date: '2025-09-30',
        recovery_days: 122,
        max_drawdown_duration_days: 242,
      },
    },
  },
  rolling_cagr: [],
}

test.use({ viewport: { width: 1440, height: 1100 } })

test('portfolio/risco', async ({ page, mockApi }) => {
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1/analysis', ANALYSIS)

  await page.goto('/portfolio/analysis')

  await expect(page.getByRole('heading', { name: 'Risco' })).toBeVisible()
  await expect(page.getByText('Volatilidade anual')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('panel-risk.png')
})
