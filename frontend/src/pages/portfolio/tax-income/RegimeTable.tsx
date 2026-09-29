import type { MonthlyAssessment, RealizedSale, RegimeAssessment } from '@/api/incomeTax'
import {
  AppCard,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import {
  REGIME_LABEL,
  formatDay,
  formatMonth,
  formatRate,
  formatTaxAmount,
  formatTaxValue,
  gainTone,
  money,
} from './format'

/* A apuração mensal de um regime e as vendas que a formam.
 *
 * Operações comuns, FII e cripto são a mesma tabela sobre a mesma resposta;
 * muda o que cada regime tem: só as operações comuns e a cripto têm isenção,
 * e a cripto não compensa prejuízo. As colunas que não se aplicam saem, em vez
 * de ficar mostrando zero.
 *
 * As vendas embaixo são a conferência: o resultado de cada uma é valor da
 * venda, menos taxas, menos o custo médio de todas as carteiras. */

interface Props {
  regime: RegimeAssessment
  sales: RealizedSale[]
  fiscalYear: number
}

function Gain({
  value,
  format = formatTaxValue,
}: {
  value: string
  format?: (value: string) => string
}) {
  return (
    <AppText variant="bodySmall" tone={gainTone(value)} noWrap>
      {format(value)}
    </AppText>
  )
}

function monthColumns(regime: RegimeAssessment): AppSimpleTableColumn<MonthlyAssessment>[] {
  const hasExemption = regime.monthly_sales_exemption !== null
  const exemptionLimit = regime.monthly_sales_exemption
    ? formatTaxValue(regime.monthly_sales_exemption)
    : ''
  const columns: (AppSimpleTableColumn<MonthlyAssessment> | false)[] = [
    { label: 'Mês', render: (month) => formatMonth(month.month) },
    /* No regime comum o que decide a isenção é a venda de ações, e é ela que
       a coluna mostra; o total inclui ETF e BDR e está nas vendas do ano. */
    regime.regime !== 'common' && {
      label: 'Vendas',
      align: 'right',
      render: (month) => formatTaxAmount(month.sales),
    },
    hasExemption &&
      regime.regime === 'common' && {
        label: 'Vendas (ações)',
        hint: `Só a venda de ações conta para o limite de ${exemptionLimit} no mês.`,
        align: 'right',
        render: (month) => formatTaxAmount(month.exemption_sales),
      },
    {
      label: 'Resultado',
      align: 'right',
      render: (month) => <Gain value={month.result} format={formatTaxAmount} />,
    },
    hasExemption && {
      label: 'Isento',
      hint: `Vendas no limite de ${exemptionLimit}: o ganho vai para Rendimentos Isentos e não consome prejuízo.`,
      align: 'right',
      render: (month) => formatTaxAmount(month.exempt_gain),
    },
    regime.carries_losses === true && {
      label: 'Compensado',
      hint: 'Prejuízo de meses anteriores abatido do ganho do mês.',
      align: 'right',
      render: (month) => formatTaxAmount(month.loss_used),
    },
    regime.carries_losses === true && {
      label: 'Prejuízo',
      hint: 'Prejuízo a compensar no fim do mês, que passa aos seguintes — inclusive ao ano que vem.',
      align: 'right',
      render: (month) => formatTaxAmount(month.loss_carried_out),
    },
    { label: 'Base', align: 'right', render: (month) => formatTaxAmount(month.taxable_base) },
    {
      label: `Imposto (${formatRate(regime.rate)})`,
      align: 'right',
      render: (month) => (month.covered ? formatTaxAmount(month.tax_due) : 'sem regra'),
    },
    regime.regime !== 'crypto' && {
      label: 'IRRF',
      hint: 'O "dedo-duro" retido nas vendas; o que não couber no mês passa aos seguintes do mesmo ano.',
      align: 'right',
      render: (month) => formatTaxAmount(month.withheld_used),
    },
    { label: 'A pagar', align: 'right', render: (month) => formatTaxAmount(month.tax_payable) },
  ]
  return columns.filter((column): column is AppSimpleTableColumn<MonthlyAssessment> => !!column)
}

const SALE_COLUMNS: AppSimpleTableColumn<RealizedSale>[] = [
  { label: 'Data', render: (sale) => formatDay(sale.day), sortValue: (sale) => sale.day },
  { label: 'Ativo', render: (sale) => sale.ticker, sortValue: (sale) => sale.ticker },
  {
    label: 'Quantidade',
    align: 'right',
    render: (sale) => Number(sale.quantity).toLocaleString('pt-BR'),
  },
  { label: 'Valor da venda', align: 'right', render: (sale) => formatTaxValue(sale.gross_value) },
  {
    label: 'Taxas',
    align: 'right',
    render: (sale) => (sale.fees_informed ? formatTaxValue(sale.fees) : 'não informadas'),
  },
  { label: 'Custo médio', align: 'right', render: (sale) => formatTaxValue(sale.cost) },
  {
    label: 'Resultado',
    align: 'right',
    render: (sale) => <Gain value={sale.result} />,
    sortValue: (sale) => money(sale.result),
  },
  {
    label: 'IRRF',
    align: 'right',
    render: (sale) => formatTaxValue(sale.withheld_income_tax),
  },
]

function ruleNote(regime: RegimeAssessment): string {
  const parts = [`Alíquota ${formatRate(regime.rate)}`]
  if (regime.monthly_sales_exemption) {
    parts.push(
      regime.regime === 'common'
        ? `ganho isento quando as vendas de ações no mês somam até ${formatTaxValue(regime.monthly_sales_exemption)} — ETF e BDR não têm isenção`
        : `mês isento quando as vendas somam até ${formatTaxValue(regime.monthly_sales_exemption)}`
    )
  }
  parts.push(
    regime.carries_losses
      ? 'prejuízo compensa ganhos futuros do mesmo regime'
      : 'perda não compensa ganho, nem no mesmo mês'
  )
  return `${parts.join('; ')}. DARF ${regime.revenue_code ?? '—'}. Base legal: ${regime.source ?? '—'}.`
}

export default function RegimeTable({ regime, sales, fiscalYear }: Props) {
  const regimeSales = sales.filter((sale) => sale.regime === regime.regime)

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack gap="sm">
          <SectionTitle>{`${REGIME_LABEL[regime.regime]} (${fiscalYear}, em R$)`}</SectionTitle>
          <AppText variant="bodySmall" tone="secondary">
            {ruleNote(regime)}
          </AppText>
          <AppSimpleTable
            rows={regime.months}
            columns={monthColumns(regime)}
            getRowKey={(month) => month.month}
          />
          {(money(regime.loss_to_carry) > 0 || money(regime.withheld_to_declare) > 0) && (
            <AppText variant="bodySmall" tone="secondary">
              {[
                money(regime.loss_to_carry) > 0 &&
                  `Prejuízo a compensar em 31/12: ${formatTaxValue(regime.loss_to_carry)}.`,
                money(regime.withheld_to_declare) > 0 &&
                  `IRRF não compensado no ano, para a declaração: ${formatTaxValue(regime.withheld_to_declare)}.`,
              ]
                .filter(Boolean)
                .join(' ')}
            </AppText>
          )}
        </AppStack>
      </AppCard>

      <AppCard>
        <AppStack gap="sm">
          <SectionTitle>Vendas do ano</SectionTitle>
          <AppSimpleTable
            rows={regimeSales}
            columns={SALE_COLUMNS}
            getRowKey={(sale) => sale.transaction_id}
            emptyMessage="Nenhuma venda no ano."
          />
        </AppStack>
      </AppCard>
    </AppStack>
  )
}
