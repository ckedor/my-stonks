import { expect, expectNothingClipped, test } from './fixtures/app'

/* Declaração de imposto de renda: as quatro abas. Snapshot antes da
   migração, como nas outras telas. */

const HOJE = new Date('2026-03-17T12:00:00-03:00')

const PORTFOLIOS = [
  { id: 1, name: 'Principal', user_id: 1, custom_categories: [] },
]

const DARF = [
  {
    month: '2025-02',
    entries: [
      { label: 'FIIs', gross_sales: 12000, base: 1800, tax: 360, darf: 360 },
      { label: 'Ações', gross_sales: 8000, base: -400, tax: 0, darf: 0 },
    ],
  },
  {
    month: '2025-09',
    entries: [{ label: 'FIIs', gross_sales: 5400, base: 900, tax: 180, darf: 180 }],
  },
]

const APURACAO = [
  { month: '2025-02', gross_sales: 12000, realized_profit: 1800, accumulated_loss: 0, tax_due: 360 },
  { month: '2025-06', gross_sales: 0, realized_profit: 0, accumulated_loss: 400, tax_due: 0 },
  { month: '2025-09', gross_sales: 5400, realized_profit: 900, accumulated_loss: 0, tax_due: 180 },
]

const BENS = [
  {
    grupo: '07', codigo: '03', discriminacao: '90 cotas de CSHG Logística (HGLG11)',
    position_previous_year: 12800, position_fiscal_year: 13113, exempt_dividends: 880,
    codigo_negociacao: 'HGLG11', negociado_em_bolsa: true, locale: 'Brasil',
    cnpj: '11.728.688/0001-47',
  },
  {
    grupo: '03', codigo: '01', discriminacao: '300 ações de Petrobras PN (PETR4)',
    position_previous_year: 9720, position_fiscal_year: 13800, exempt_dividends: 0,
    codigo_negociacao: 'PETR4', negociado_em_bolsa: true, locale: 'Brasil',
    cnpj: '33.000.167/0001-01',
  },
]

async function abrirIR(page: import('@playwright/test').Page, mockApi: (path: string, body: unknown) => Promise<void>) {
  await page.clock.setFixedTime(HOJE)
  await mockApi('/portfolio', PORTFOLIOS)
  await mockApi('/portfolio/position/1', [])
  await mockApi('/portfolio/dividend', [])
  await mockApi('/portfolio/transaction', [])
  await mockApi('/portfolio/income_tax/1/darf', DARF)
  await mockApi('/portfolio/income_tax/1/assets_and_rights', BENS)
  await mockApi('/portfolio/income_tax/1/variable_income/fii_operation', APURACAO)
  await mockApi('/portfolio/income_tax/1/variable_income/common_operation', APURACAO)
  await page.goto('/portfolio/tax-income')
}

test.use({ viewport: { width: 1440, height: 900 } })

test('portfolio/imposto de renda — DARF', async ({ page, mockApi }) => {
  await abrirIR(page, mockApi)

  await expect(page.getByText('Meu DARF (2025)')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-tax-darf.png')
})

test('portfolio/imposto de renda — bens e direitos', async ({ page, mockApi }) => {
  await abrirIR(page, mockApi)

  await page.getByRole('tab', { name: 'Bens e Direitos' }).click()
  await expect(page.getByText('HGLG11').first()).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-tax-assets.png')
})

test('portfolio/imposto de renda — apuração FIIs', async ({ page, mockApi }) => {
  await abrirIR(page, mockApi)

  await page.getByRole('tab', { name: 'Apuração FIIs' }).click()
  await expect(page.getByText('Apuração de Ganhos - FIIs (2025)')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-tax-fii.png')
})
