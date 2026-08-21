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
