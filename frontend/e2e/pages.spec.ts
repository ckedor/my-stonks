import { expect, expectNothingClipped, test } from './fixtures/app'

/* As telas restantes, uma por vez. Como nas outras, os snapshots nascem
   antes da migração. */

const HOJE = new Date('2026-03-17T12:00:00-03:00')

const PORTFOLIOS = [
  {
    id: 1,
    name: 'Principal',
    user_id: 1,
    custom_categories: [
      { id: 10, name: 'Ações', color: '#1976d2', benchmark_id: null },
      { id: 11, name: 'FIIs', color: '#2e7d32', benchmark_id: null },
    ],
  },
]

const POSICOES = [
  {
    asset_id: 1, date: '2026-03-17', ticker: 'PETR4', name: 'Petrobras PN',
    quantity: 300, average_price: 32.4, profit_pct: 41.98, category: 'Ações',
    value: 13800, price: 46, acc_return: 0.4198, twelve_months_return: 0.1903,
    cagr: 0.1832, total_invested: 9720, type: 'Ação', class: 'Renda Variável',
    exchange: 'B3', segment: 'equity-br', sector: 'Petróleo e Gás',
  },
  {
    asset_id: 2, date: '2026-03-17', ticker: 'HGLG11', name: 'CSHG Logística',
    quantity: 90, average_price: 152.1, profit_pct: -4.2, category: 'FIIs',
    value: 13113, price: 145.7, acc_return: -0.042, twelve_months_return: 0.061,
    cagr: 0.074, total_invested: 13689, type: 'FII', class: 'Renda Variável',
    exchange: 'B3', segment: 'fii', fii_type: 'Tijolo', fii_segment: 'Logística',
  },
  {
    asset_id: 3, date: '2026-03-17', ticker: 'BOVA11', name: 'iShares Ibovespa',
    quantity: 40, average_price: 108.5, profit_pct: 12.4, category: 'Ações',
    value: 4877, price: 121.9, acc_return: 0.124, twelve_months_return: 0.088,
    cagr: 0.095, total_invested: 4340, type: 'ETF', class: 'Renda Variável',
    exchange: 'B3', segment: 'equity-br', etf_segment: 'Ações Brasil',
  },
]

test.use({ viewport: { width: 1440, height: 1200 } })

test('login', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('button', { name: 'Acessar conta' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-login.png')
})

test('portfolio/trades', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/transaction', [
    {
      id: 1, asset_id: 1, date: '2025-11-04', ticker: 'PETR4', type: 'Compra',
      quantity: 100, price: 30.5, value: 3050, average_price: 30.5, broker: 'Rico',
      broker_id: 1, realized_profit: 0, acc_quantity: 100, position: 3050,
      profit_pct: 0, portfolio_id: 1, original_price: 30.5, currency: 'BRL',
    },
    {
      id: 2, asset_id: 2, date: '2026-02-20', ticker: 'HGLG11', type: 'Venda',
      quantity: -50, price: 144.9, value: -7245, average_price: 152.1, broker: 'Avenue',
      broker_id: 2, realized_profit: -360, acc_quantity: 90, position: 13113,
      profit_pct: -4.73, portfolio_id: 1, original_price: 144.9, currency: 'BRL',
    },
  ])

  await page.goto('/portfolio/trades')

  await expect(page.getByText('HGLG11')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-trades.png')
})

const REBALANCEAMENTO = {
  portfolio_id: 1,
  total_value: 31790,
  categories: [
    {
      category_id: 10, category_name: 'Ações', color: '#1976d2',
      current_value: 18677, current_pct: 58.75, target_pct: 60, target_value: 19074,
      diff_pct: 1.25, diff_value: 397,
      assets: [
        {
          asset_id: 1, ticker: 'PETR4', name: 'Petrobras PN', category: 'Ações',
          category_id: 10, current_value: 13800, current_pct_in_category: 73.89,
          target_pct_in_category: 70, target_value: 13352, diff_pct: -3.89, diff_value: -448,
        },
        {
          asset_id: 3, ticker: 'BOVA11', name: 'iShares Ibovespa', category: 'Ações',
          category_id: 10, current_value: 4877, current_pct_in_category: 26.11,
          target_pct_in_category: 30, target_value: 5722, diff_pct: 3.89, diff_value: 845,
        },
      ],
    },
    {
      category_id: 11, category_name: 'FIIs', color: '#2e7d32',
      current_value: 13113, current_pct: 41.25, target_pct: 40, target_value: 12716,
      diff_pct: -1.25, diff_value: -397,
      assets: [
        {
          asset_id: 2, ticker: 'HGLG11', name: 'CSHG Logística', category: 'FIIs',
          category_id: 11, current_value: 13113, current_pct_in_category: 100,
          target_pct_in_category: 100, target_value: 12716, diff_pct: 0, diff_value: -397,
        },
      ],
    },
  ],
}

/* Onde o dinheiro está e onde ele deveria estar viraram uma tela só, então
   é um teste só: o mapa e os alvos são a mesma leitura em duas metades. A
   tela ficou o dobro de alta por isso, e a viewport acompanha — é o que o
   `expectNothingClipped` cobra. */
test.describe(() => {
  test.use({ viewport: { width: 1440, height: 1700 } })

test('portfolio/distribuição', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1', POSICOES)
  await mockApi('/portfolio/rebalancing/1', REBALANCEAMENTO)

  await page.goto('/portfolio/distribution')

  await expect(page.getByRole('heading', { name: 'Distribuição' })).toBeVisible()
  await expect(page.getByText('PETR4').first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Categoria / Ativo' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-distribution.png')

  /* Ligado o interruptor, a última coluna deixa de ser diagnóstico e vira
     compra: a mesma tela responde a outra pergunta, e as duas precisam de
     linha de base. */
  await page.getByRole('checkbox', { name: 'Simular aporte' }).check()
  await page.getByLabel('Aporte', { exact: true }).fill('10000')

  await expect(page.getByRole('columnheader', { name: 'Comprar' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-distribution-contribution.png')
})

})

/* O link antigo do rebalanceamento continua chegando na tela que o absorveu. */
test('portfolio/rebalanceamento leva à distribuição', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1', POSICOES)
  await mockApi('/portfolio/rebalancing/1', REBALANCEAMENTO)

  await page.goto('/portfolio/rebalancing')

  await expect(page).toHaveURL(/\/portfolio\/distribution$/)
  await expect(page.getByRole('heading', { name: 'Distribuição' })).toBeVisible()
})

test('portfolio/categoria', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1', POSICOES)
  await mockApi('/portfolio/position/1/returns', [
    { date: '2025-03-17', daily_return: 0, acc_return: 0, cagr: null },
    { date: '2026-03-17', daily_return: 0.002, acc_return: 0.21, cagr: 0.21 },
  ])
  await mockApi('/portfolio/position/1/category/returns', [
    {
      date: '2025-03-17', custom_category_id: 10, category: 'Ações',
      daily_return: 0, acc_return: 0, cagr: null,
    },
    {
      date: '2025-09-17', custom_category_id: 10, category: 'Ações',
      daily_return: 0.003, acc_return: 0.16, cagr: 0.33,
    },
    {
      date: '2026-03-17', custom_category_id: 10, category: 'Ações',
      daily_return: 0.001, acc_return: 0.28, cagr: 0.28,
    },
    {
      date: '2025-03-17', custom_category_id: 11, category: 'FIIs',
      daily_return: 0, acc_return: 0, cagr: null,
    },
    {
      date: '2026-03-17', custom_category_id: 11, category: 'FIIs',
      daily_return: -0.001, acc_return: -0.04, cagr: -0.04,
    },
  ])
  await mockApi('/portfolio/position/1/patrimony_evolution', [
    { date: '2025-03-17', portfolio: 24000, aported: 24000, 'Ações': 14000, FIIs: 10000 },
    { date: '2026-03-17', portfolio: 31790, aported: 300, 'Ações': 18677, FIIs: 13113 },
  ])
  await mockApi('/portfolio/dividend', [])
  await mockApi('/portfolio/transaction', [])
  await mockApi('/portfolio/rebalancing/1', REBALANCEAMENTO)
  await mockApi('/market_data/series/time_series', {
    CDI: [
      { date: '2025-03-17', value: 0 },
      { date: '2026-03-17', value: 0.12 },
    ],
  })
  /* Uma requisição por ativo, que é o que alimenta o mini gráfico do card. */
  for (const [assetId, ticker] of [[1, 'PETR4'], [3, 'BOVA11']] as const) {
    await mockApi(`/portfolio/position/1/asset/${assetId}/returns`, [
      { date: '2025-03-17', [ticker]: 0 },
      { date: '2025-09-17', [ticker]: 0.09 },
      { date: '2026-03-17', [ticker]: 0.18 },
    ])
  }

  await page.goto('/portfolio/category/10')

  await expect(page.getByRole('heading', { name: 'Ações' })).toBeVisible()
  // O ticker aparece duas vezes: rotula a fatia da pizza e nomeia o card.
  await expect(page.getByText('PETR4').first()).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Risco' })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-category.png')

  /* As outras abas só precisam provar que renderizam com o recorte da
     categoria: o visual delas já é o das telas da carteira, que têm snapshot
     próprio. A análise de risco é a única busca desta tela, e é a aba que a
     dispara. */
  await mockApi('/portfolio/position/1/category/10/analysis', {
    start_date: '2025-03-17',
    performance_metrics: {
      cagr: 0.28,
      benchmarks_metrics: { CDI: { cagr: 0.12, alpha: 0.16, beta: 0.4, correlation: 0.1 } },
    },
    risk_metrics: {
      annualized_vol: 0.18, sharpe_ratio: 0.9, semideviation: 0.12,
      skewness: -0.2, kurtosis: 3.1, var_95: -0.02, cvar_95: -0.03,
      drawdown: {
        series: [
          { date: '2025-03-17', drawdown: 0 },
          { date: '2025-09-17', drawdown: -0.07 },
          { date: '2026-03-17', drawdown: -0.01 },
        ],
        stats: {
          max_drawdown: -0.07, max_drawdown_date: '2025-09-17',
          peak_date_before_max_dd: '2025-06-10', recovery_date: '2025-10-27',
          recovery_days: 40, max_drawdown_duration_days: 132,
        },
      },
    },
    rolling_cagr: [],
  })

  await page.getByRole('tab', { name: 'Risco' }).click()
  await expect(page.getByText('Volatilidade anual')).toBeVisible()

  await page.getByRole('tab', { name: 'Proventos' }).click()
  await expect(page.getByText('Nenhum provento recebido neste recorte.')).toBeVisible()

  await page.getByRole('tab', { name: 'Trades' }).click()
  await expect(page.getByText('Nenhuma operação registrada neste recorte.')).toBeVisible()

  /* Distribuição de uma categoria é o rebalanceamento dela: o alvo é da
     categoria, então é a categoria inteira que entra na aba. */
  await page.getByRole('tab', { name: 'Distribuição' }).click()
  await expect(page.getByRole('columnheader', { name: 'Categoria / Ativo' })).toBeVisible()
  await expect(page.getByText('BOVA11')).toBeVisible()
})

test('portfolio/fiis mostra desempenho, patrimônio e risco do segmento', async ({ page, mockApi }) => {
  await page.clock.setFixedTime(HOJE)
  const fiiPositions = [
    { ...POSICOES[1], type_id: 2 },
    {
      asset_id: 4, date: '2026-03-17', ticker: 'XPML11', name: 'XP Malls',
      quantity: 80, average_price: 102, profit_pct: 8.2, category: 'FIIs',
      value: 8824, price: 110.3, acc_return: 0.082, twelve_months_return: 0.11,
      cagr: 0.09, total_invested: 8160, type: 'FII', type_id: 2,
      class: 'Renda Variável', exchange: 'B3', segment: 'fii',
      fii_type: 'Tijolo', fii_segment: 'Shoppings',
    },
  ]
  const typeReturns = [
    { date: '2025-03-17', daily_return: 0, acc_return: 0, cagr: null },
    { date: '2025-09-17', daily_return: 0.002, acc_return: 0.08, cagr: 0.16 },
    { date: '2026-03-17', daily_return: 0.001, acc_return: 0.18, cagr: 0.18 },
  ]
  const analysis = {
    start_date: '2025-03-17',
    performance_metrics: {
      cagr: 18,
      benchmarks_metrics: { CDI: { cagr: 12, alpha: 6, beta: 0.4, correlation: 0.1 } },
    },
    risk_metrics: {
      annualized_vol: 0.13, sharpe_ratio: 0.8, semideviation: 0.09,
      skewness: -0.2, kurtosis: 3.1, var_95: -0.018, cvar_95: -0.026,
      drawdown: {
        series: [
          { date: '2025-03-17', drawdown: 0 },
          { date: '2025-09-17', drawdown: -0.06 },
          { date: '2026-03-17', drawdown: -0.01 },
        ],
        stats: {
          max_drawdown: -0.06, max_drawdown_date: '2025-09-17',
          peak_date_before_max_dd: '2025-06-10', recovery_date: '2025-11-01',
          recovery_days: 45, max_drawdown_duration_days: 138,
        },
      },
    },
    rolling_cagr: [],
  }

  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1', fiiPositions)
  await mockApi('/portfolio/position/1/segment/fii/returns', typeReturns)
  await mockApi('/portfolio/position/1/segment/fii/analysis', analysis)
  await mockApi('/portfolio/position/1/returns', typeReturns)
  await mockApi('/portfolio/position/1/category/returns', [])
  await mockApi('/portfolio/position/1/patrimony_evolution', [
    { date: '2025-03-17', portfolio: 18000, aported: 18000 },
    { date: '2026-03-17', portfolio: 21937, aported: 200 },
  ])
  await mockApi('/portfolio/dividend', [])
  await mockApi('/portfolio/transaction', [])
  await mockApi('/portfolio/rebalancing/1', REBALANCEAMENTO)
  await mockApi('/portfolio/position/1/analysis', analysis)
  await mockApi('/market_data/series/time_series', { CDI: [] })
  for (const [assetId, ticker] of [[2, 'HGLG11'], [4, 'XPML11']] as const) {
    await mockApi(`/portfolio/position/1/asset/${assetId}/returns`, [
      { date: '2025-03-17', [ticker]: 0 },
      { date: '2026-03-17', [ticker]: 0.12 },
    ])
  }

  await page.goto('/portfolio/fii')

  await expect(page.getByRole('heading', { name: 'FIIs', exact: true })).toBeVisible()
  await expect(page.getByText('+18,00%').first()).toBeVisible()
  await expect(page.locator('canvas').first()).toBeVisible()
  await expect(page).toHaveScreenshot('page-fiis.png')

  /* A dimensão que toda tela especializada tem: o peso de cada ativo, na
     mesma pizza onde a concentração por tipo é lida. */
  await page.getByRole('button', { name: 'Ativo' }).click()
  await expect(page.getByText('HGLG11').first()).toBeVisible()

  await page.getByRole('tab', { name: 'Risco' }).click()
  await expect(page.getByText('Volatilidade anual')).toBeVisible()

  await page.getByRole('tab', { name: 'Patrimônio' }).click()
  await expect(page.getByText('Projeção')).toBeVisible()

  await page.getByRole('tab', { name: 'Proventos' }).click()
  await expect(page.getByText('Nenhum provento recebido neste recorte.')).toBeVisible()

  await page.getByRole('tab', { name: 'Distribuição' }).click()
  await expect(page.getByRole('columnheader', { name: 'Categoria / Ativo' })).toBeVisible()
})

/* As quatro telas novas são a mesma tela do FII com outro recorte, e o que
   prova isso é que a mesma navegação encontra cada uma delas. */
for (const [path, title] of [
  ['/portfolio/equity-br', 'Ações/ETFs BR'],
  ['/portfolio/equity-world', 'Ações/ETFs Mundo'],
  ['/portfolio/fixed-income', 'Renda Fixa'],
  ['/portfolio/crypto', 'Cripto'],
] as const) {
  test(`${path} abre o segmento`, async ({ page, mockApi }) => {
    await page.clock.setFixedTime(HOJE)
    await mockApi('/portfolio', PORTFOLIOS)
    await mockApi('/portfolio/position/1', POSICOES)
    await mockApi('/portfolio/dividend', [])
    await mockApi('/portfolio/transaction', [])
    await mockApi('/market_data/series/time_series', { CDI: [] })

    await page.goto(path)

    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  })
}
