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

const ASSET = {
  id: 5,
  ticker: 'PETR4',
  name: 'Petrobras PN',
  asset_type_id: 1,
  asset_type: {
    id: 1,
    short_name: 'AÇÃO',
    name: 'Ação',
    asset_class_id: 2,
    asset_class: { id: 2, name: 'Renda Variável' },
  },
}

const COTACOES = Array.from({ length: 24 }, (_, i) => {
  const mes = String((i % 12) + 1).padStart(2, '0')
  const ano = 2024 + Math.floor(i / 12)
  const close = 30 + i * 0.8
  return {
    date: `${ano}-${mes}-15`,
    open: close - 0.6,
    high: close + 1.1,
    low: close - 1.3,
    close,
    adjusted_close: close,
    volume: 1000,
  }
})

const POSICAO = {
  asset_id: 5,
  date: '2026-03-17',
  ticker: 'PETR4',
  name: 'Petrobras PN',
  quantity: 300,
  average_price: 32.4,
  profit_pct: 0.42,
  category: 'Ações',
  value: 13800,
  price: 46,
  acc_return: 0.42,
  twelve_months_return: 0.19,
  cagr: 0.1832,
  total_invested: 9720,
  type: 'Ação',
  class: 'Renda Variável',
}

const RETORNOS_DO_ATIVO = [
  { date: '2025-04-15', value: 0 },
  { date: '2025-06-15', value: 0.031 },
  { date: '2025-08-15', value: 0.078 },
  { date: '2025-10-15', value: 0.052 },
  { date: '2025-12-15', value: 0.124 },
  { date: '2026-02-15', value: 0.163 },
  { date: '2026-03-17', value: 0.19 },
]

/* O relógio parado importa aqui: a janela do mini gráfico é contada a partir
   de hoje, e o rótulo dela ("12m", "8m") mudaria sozinho. */
const HOJE = new Date('2026-03-17T12:00:00-03:00')

/* Só a faixa de cima da tela: `AssetHeader` e `AssetPositionCard`. O gráfico
   de candles abaixo é canvas e é outra migração — puxá-lo para dentro deste
   snapshot seria trocar o que está sendo provado por uma fonte de ruído. */
const FAIXA_DO_CABECALHO = { x: 0, y: 60, width: 1440, height: 230 }

async function abrirAtivoDeMercado(page: import('@playwright/test').Page) {
  await page.clock.setFixedTime(HOJE)
  await page.addInitScript((asset) => {
    localStorage.setItem(
      'market-store',
      JSON.stringify({ state: { assets: [asset], assetTypes: [asset.asset_type] }, version: 0 }),
    )
  }, ASSET)
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

test('market/asset — cabeçalho sem posição', async ({ page, mockApi }) => {
  await abrirAtivoDeMercado(page)
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/market_data/quotes/asset/5', {
    ticker: 'PETR4',
    asset_type: 'Ação',
    currency: 'BRL',
    logo_url: null,
    source: 'database',
    cagr: { value: 0.1832, start_date: '2024-01-15' },
    quotes: COTACOES,
  })

  await page.goto('/market/asset/5')
  await expect(page.getByRole('button', { name: 'Comprar' })).toBeVisible()

  await expect(page).toHaveScreenshot('panel-asset-header.png', { clip: FAIXA_DO_CABECALHO })
})

test('market/asset — cabeçalho com posição', async ({ page, mockApi }) => {
  await abrirAtivoDeMercado(page)
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1', [POSICAO])
  await mockApi('/portfolio/position/1/asset/5/returns', RETORNOS_DO_ATIVO)
  await mockApi('/market_data/quotes/asset/5', {
    ticker: 'PETR4',
    asset_type: 'Ação',
    currency: 'BRL',
    logo_url: null,
    source: 'database',
    cagr: { value: 0.1832, start_date: '2024-01-15' },
    quotes: COTACOES,
  })

  await page.goto('/market/asset/5')
  await expect(page.getByText('Na carteira')).toBeVisible()

  await expect(page).toHaveScreenshot('panel-asset-header-position.png', { clip: FAIXA_DO_CABECALHO })
})
