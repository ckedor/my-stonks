import { expect, expectNothingClipped, test } from './fixtures/app'

/* Os gráficos, nas telas que os hospedam.
 *
 * O canvas do lightweight-charts entra aqui, e não nos snapshots dos
 * painéis, porque nesta tela ele é o assunto: conferi que duas execuções
 * seguidas desenham o mesmo pixel antes de guardar a referência. */

const PORTFOLIOS = [
  {
    id: 1,
    name: 'Principal',
    user_id: 1,
    custom_categories: [{ id: 10, name: 'Renda Fixa', color: '#1976d2', benchmark_id: 3 }],
  },
]

/* Dezoito meses de patrimônio, com o aporte de cada um. O aporte cicla em
   cinco valores para as barras não virarem uma escada — uma série monótona
   esconderia um erro de escala no eixo. */
const PATRIMONIO = Array.from({ length: 18 }, (_, i) => {
  const date = new Date(Date.UTC(2024, 9 + i, 1)).toISOString().slice(0, 10)
  return {
    date,
    portfolio: 100000 + i * 4200,
    'Renda Fixa': 40000 + i * 900,
    aported: 1500 + (i % 5) * 400,
  }
})

const HOJE = new Date('2026-03-17T12:00:00-03:00')

test.use({ viewport: { width: 1440, height: 1400 } })

test('portfolio/patrimônio', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1/patrimony_evolution', PATRIMONIO)

  await page.goto('/portfolio/wealth')

  await expect(page.getByRole('heading', { name: 'Evolução do Patrimônio' })).toBeVisible()
  await expect(page.getByText('Aportes Mensais')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('chart-wealth.png')
})

const ATIVO = {
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

/* Dois anos de pregões mensais, com máxima e mínima em volta do fechamento:
   é o que faz a vela ter corpo e sombra, e o que a régua e a escala
   logarítmica têm para trabalhar. A série ajustada existe para ligar o
   seletor Preço/Ajustado. */
const COTACOES = Array.from({ length: 24 }, (_, i) => {
  const mes = String((i % 12) + 1).padStart(2, '0')
  const ano = 2024 + Math.floor(i / 12)
  const close = 30 + i * 0.8 + (i % 3) * 0.9
  return {
    date: `${ano}-${mes}-15`,
    open: close - 0.6,
    high: close + 1.1,
    low: close - 1.3,
    close,
    adjusted_close: close - 0.4,
    volume: 1000 + (i % 4) * 250,
  }
})

test('market/asset — gráfico de cotação', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await page.addInitScript((asset) => {
    localStorage.setItem(
      'market-store',
      JSON.stringify({ state: { assets: [asset], assetTypes: [asset.asset_type] }, version: 0 }),
    )
  }, ATIVO)
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

  await expect(page.getByRole('heading', { name: 'Cotação' })).toBeVisible()
  await expect(page.getByText('Régua')).toBeVisible()

  await expect(page).toHaveScreenshot('chart-candle.png')
})

/* Proventos de dois anos e três categorias: é o que o gráfico por
   categoria compara e o que enche os filtros da tela. */
const PROVENTOS = [
  { id: 1, asset_id: 1, date: '2025-02-14', ticker: 'PETR4', amount: 120.5, category: 'Ações', portfolio_id: 1 },
  { id: 2, asset_id: 2, date: '2025-03-20', ticker: 'HGLG11', amount: 88.3, category: 'FIIs', portfolio_id: 1 },
  { id: 3, asset_id: 1, date: '2025-05-14', ticker: 'PETR4', amount: 98.2, category: 'Ações', portfolio_id: 1 },
  { id: 4, asset_id: 3, date: '2025-06-30', ticker: 'CDB XP', amount: 210.0, category: 'Renda Fixa', portfolio_id: 1 },
  { id: 5, asset_id: 2, date: '2025-08-20', ticker: 'HGLG11', amount: 91.7, category: 'FIIs', portfolio_id: 1 },
  { id: 6, asset_id: 1, date: '2025-11-14', ticker: 'PETR4', amount: 76.4, category: 'Ações', portfolio_id: 1 },
  { id: 7, asset_id: 2, date: '2026-01-20', ticker: 'HGLG11', amount: 95.1, category: 'FIIs', portfolio_id: 1 },
  { id: 8, asset_id: 1, date: '2026-02-13', ticker: 'PETR4', amount: 165.9, category: 'Ações', portfolio_id: 1 },
]

test('portfolio/proventos', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await mockApi('/portfolio', [
    {
      id: 1,
      name: 'Principal',
      user_id: 1,
      custom_categories: [
        { id: 10, name: 'Ações', color: '#1976d2', benchmark_id: null },
        { id: 11, name: 'FIIs', color: '#2e7d32', benchmark_id: null },
        { id: 12, name: 'Renda Fixa', color: '#ed6c02', benchmark_id: 3 },
      ],
    },
  ])
  await mockApi('/portfolio/dividend', PROVENTOS)

  await page.goto('/portfolio/dividends')

  await expect(page.getByText('HGLG11').first()).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('chart-dividends.png')
})

/* Retorno acumulado mês a mês, dois anos e meio, em fração — é assim que a
   API entrega e o gráfico lê. A carteira e uma categoria, que é o mínimo
   para o gráfico principal ter o que sobrepor e para o heatmap ter linhas
   de anos diferentes. */
const RETORNO_MENSAL_PCT = [
  0, 1.8, 3.1, 2.4, 4.9, 6.2, 5.5, 7.8, 9.1, 8.3, 10.7, 12.4,
  13.1, 11.9, 14.6, 16.2, 15.4, 18.1, 19.8, 21.3, 20.5, 23.2, 25.1, 26.8,
  27.9, 29.4, 31.1,
]

function serieDeRetorno(escala: number) {
  return RETORNO_MENSAL_PCT.map((value, i) => ({
    date: new Date(Date.UTC(2024, i, 1)).toISOString().slice(0, 10),
    acc_return: Number(((value / 100) * escala).toFixed(4)),
    cagr: Number((0.118 * escala).toFixed(4)),
  }))
}

test('portfolio/rentabilidade', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1/returns', serieDeRetorno(1))
  await mockApi(
    '/portfolio/position/1/category/returns',
    serieDeRetorno(0.7).map((entry) => ({ ...entry, category: 'Renda Fixa' })),
  )
  await mockApi('/market_data/series/time_series', {
    CDI: RETORNO_MENSAL_PCT.map((value, i) => ({
      date: new Date(Date.UTC(2024, i, 1)).toISOString().slice(0, 10),
      value: Number(((value / 100) * 0.45).toFixed(4)),
    })),
  })

  await page.goto('/portfolio/returns')

  await expect(page.getByRole('heading', { name: 'Rentabilidade Carteira' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('chart-returns.png')
})
