import { expect, expectNothingClipped, test } from './fixtures/app'

/* Declaração de imposto de renda: a apuração do ano (DARF, FII) e o informe
   de bens e direitos. A apuração vem numa resposta só, com dinheiro em texto
   exato, como o backend a manda. */

const HOJE = new Date('2026-03-17T12:00:00-03:00')

const PORTFOLIOS = [
  { id: 1, name: 'Principal', user_id: 1, custom_categories: [] },
]

const ZERO = '0.00'

/** Doze meses de um regime, zerados, com os meses informados por cima. */
function months(overrides: Record<number, Record<string, string | boolean>>) {
  return Array.from({ length: 12 }, (_, i) => ({
    month: `2025-${String(i + 1).padStart(2, '0')}-01`,
    covered: true,
    sales: ZERO,
    exemption_sales: ZERO,
    within_exemption: true,
    result: ZERO,
    exempt_gain: ZERO,
    loss_carried_in: ZERO,
    loss_used: ZERO,
    loss_carried_out: ZERO,
    taxable_base: ZERO,
    tax_due: ZERO,
    withheld_in_month: ZERO,
    withheld_carried_in: ZERO,
    withheld_used: ZERO,
    withheld_carried_out: ZERO,
    tax_payable: ZERO,
    ...overrides[i + 1],
  }))
}

const ASSESSMENT = {
  fiscal_year: 2025,
  filing_year: 2026,
  darf_minimum: '10.00',
  regimes: [
    {
      regime: 'common',
      rate: '0.15',
      revenue_code: '6015',
      monthly_sales_exemption: '20000.00',
      carries_losses: true,
      source: 'Lei 11.033/2004, arts. 2º e 3º, I; IN RFB 1.585/2015',
      months: months({
        2: { sales: '8000.00', exemption_sales: '8000.00', result: '-400.00', loss_carried_out: '400.00' },
        6: {
          sales: '30000.00', exemption_sales: '30000.00', within_exemption: false,
          result: '2400.00', loss_carried_in: '400.00', loss_used: '400.00',
          taxable_base: '2000.00', tax_due: '300.00', withheld_in_month: '1.50',
          withheld_used: '1.50', tax_payable: '298.50',
        },
      }),
      loss_to_carry: ZERO,
      withheld_to_declare: ZERO,
    },
    {
      regime: 'real_estate_fund',
      rate: '0.20',
      revenue_code: '6015',
      monthly_sales_exemption: null,
      carries_losses: true,
      source: 'Lei 8.668/1993, art. 18, II, e art. 20-A (Fiagro, Lei 14.130/2021)',
      months: months({
        2: { sales: '12000.00', result: '1800.00', taxable_base: '1800.00', tax_due: '360.00', tax_payable: '360.00' },
        9: { sales: '5400.00', result: '900.00', taxable_base: '900.00', tax_due: '180.00', tax_payable: '180.00' },
      }),
      loss_to_carry: ZERO,
      withheld_to_declare: ZERO,
    },
    {
      regime: 'crypto',
      rate: null,
      revenue_code: '4600',
      monthly_sales_exemption: '35000.00',
      carries_losses: false,
      source: 'Lei 8.981/1995, art. 21 (faixas da Lei 13.259/2016); Lei 9.250/1995, art. 22 (isenção de R$ 35 mil)',
      months: months({}),
      loss_to_carry: ZERO,
      withheld_to_declare: ZERO,
    },
  ],
  sales: [
    {
      transaction_id: 1, portfolio_id: 1, asset_id: 10, ticker: 'HGLG11', kind: 'real_estate_fund',
      regime: 'real_estate_fund', broker_id: 1, day: '2025-02-14', quantity: '75',
      gross_value: '12000.00', fees: '4.20', cost: '10195.80', result: '1800.00',
      withheld_income_tax: '0.60', fees_informed: true,
    },
    {
      transaction_id: 2, portfolio_id: 1, asset_id: 10, ticker: 'HGLG11', kind: 'real_estate_fund',
      regime: 'real_estate_fund', broker_id: 1, day: '2025-09-10', quantity: '33',
      gross_value: '5400.00', fees: '1.90', cost: '4498.10', result: '900.00',
      withheld_income_tax: '0.27', fees_informed: true,
    },
  ],
  obligations: [
    {
      revenue_code: '6015', period: '2025-02-01', due_date: '2025-03-31',
      by_regime: [{ regime: 'real_estate_fund', amount: '360.00' }],
      carried_in: ZERO, amount: '360.00', carried_out: ZERO, paid_principal: '360.00',
      balance: ZERO, status: 'paid',
      payments: [
        { id: 1, revenue_code: '6015', period: '2025-02-01', paid_on: '2025-03-20', principal: '360.00', fine: ZERO, interest: ZERO },
      ],
    },
    {
      revenue_code: '6015', period: '2025-06-01', due_date: '2025-07-31',
      by_regime: [{ regime: 'common', amount: '298.50' }],
      carried_in: ZERO, amount: '298.50', carried_out: ZERO, paid_principal: ZERO,
      balance: '298.50', status: 'overdue', payments: [],
    },
    {
      revenue_code: '6015', period: '2025-09-01', due_date: '2025-10-31',
      by_regime: [{ regime: 'real_estate_fund', amount: '180.00' }],
      carried_in: ZERO, amount: '180.00', carried_out: ZERO, paid_principal: ZERO,
      balance: '180.00', status: 'overdue', payments: [],
    },
  ],
  pendencies: [
    {
      code: 'missing_fees', message: '1 venda sem taxas informadas, na própria venda ou nas compras que formam o custo. Taxa não informada foi apurada como zero, o que deixa o resultado maior; importar a nota de corretagem completa as taxas.',
      day: null, asset_id: null, ticker: null, transaction_ids: [3],
    },
  ],
}

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
  await mockApi('/portfolio/income_tax/assessment', ASSESSMENT)
  await mockApi('/portfolio/income_tax/1/assets_and_rights', BENS)
  await page.goto('/portfolio/tax-income')
}

test.use({ viewport: { width: 1440, height: 900 } })

test('portfolio/imposto de renda — DARF', async ({ page, mockApi }) => {
  await abrirIR(page, mockApi)

  await expect(page.getByText('DARF (2025)')).toBeVisible()
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

  await page.getByRole('tab', { name: 'FII e Fiagro' }).click()
  await expect(page.getByText('FII e Fiagro (2025)')).toBeVisible()
  await expectNothingClipped(page)

  await expect(page).toHaveScreenshot('page-tax-fii.png')
})
