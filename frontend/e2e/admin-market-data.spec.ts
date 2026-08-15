import { expect, expectNothingClipped, test } from './fixtures/app'

/* As três telas de market data e a tabela que elas compartilham. Os
   snapshots nasceram antes da migração para o design system — é o que
   permite provar depois que ela não mudou nada visualmente. */

const CURRENCIES = [
  { id: 1, name: 'Real', code: 'BRL' },
  { id: 2, name: 'Dólar', code: 'USD' },
]

test('admin/market-data/usd-brl', async ({ page, mockApi }) => {
  await mockApi('/market_data/usd-brl/history', [
    { date: '2026-08-14', usd_brl: 5.4321, brl_usd: 0.184092, source: 'brapi' },
    { date: '2026-08-13', usd_brl: 5.4102, brl_usd: 0.184837, source: 'brapi' },
    { date: '2026-08-12', usd_brl: 5.3988, brl_usd: 0.185227, source: 'brapi' },
  ])

  await page.goto('/admin/market-data/usd-brl')

  await expect(page.getByRole('heading', { name: 'Dólar' })).toBeVisible()
  await expect(page.getByText('3 observações', { exact: false })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-usd-brl.png')
})

test('admin/market-data/series', async ({ page, mockApi }) => {
  await mockApi('/market_data/series/options', [
    { id: 1, short_name: 'IBOV', name: 'Ibovespa' },
    { id: 2, short_name: 'CDI', name: 'CDI' },
  ])
  await mockApi('/market_data/series/1/history', [
    { date: '2026-08-14', close: 134567.1234, open: 134000.5, high: 135000.9, low: 133800.2, source: 'brapi' },
    { date: '2026-08-13', close: 133980.4321, open: 133500.1, high: 134200.7, low: 133100.8, source: 'brapi' },
  ])

  await page.goto('/admin/market-data/series')

  await expect(page.getByRole('heading', { name: 'Séries' })).toBeVisible()
  await expect(page.getByText('2 observações', { exact: false })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-series.png')
})

test('admin/market-data/quotes', async ({ page, mockApi }) => {
  await mockApi('/market_data/asset', [
    { id: 1, ticker: 'PETR4', name: 'Petrobras PN' },
    { id: 2, ticker: 'HGLG11', name: 'CSHG Logística' },
  ])
  await mockApi('/market_data/currency', CURRENCIES)
  await mockApi('/market_data/quotes/persisted', [])

  await page.goto('/admin/market-data/quotes')

  await expect(page.getByRole('heading', { name: 'Cotações de ativos' })).toBeVisible()
  /* Sem ativo escolhido a tela mostra o convite, que é o estado inicial
     real de quem abre a página. */
  await expect(page.getByText('Selecione um ativo', { exact: false })).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('admin-quotes.png')
})
