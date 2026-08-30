import type { FIIMonthlyReport } from '@/api/market'
import {
  AppCard,
  AppGrid,
  AppMetric,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useMemo } from 'react'
import { EMPTY, formatBRL, formatCompactBRL, formatDate, formatPercent } from './format'
import { PATRIMONY_LINES } from './labels'

interface Line {
  label: string
  value: number
}

const LIABILITIES: { label: string; read: (report: FIIMonthlyReport) => number | null }[] = [
  { label: 'Rendimentos a distribuir', read: (report) => report.distributions_payable },
  { label: 'Taxas a pagar', read: (report) => report.admin_fees_payable },
  { label: 'Obrigações imobiliárias', read: (report) => report.real_estate_obligations },
]

const lines = (
  report: FIIMonthlyReport,
  source: { label: string; read: (report: FIIMonthlyReport) => number | null }[]
): Line[] =>
  source
    .map(({ label, read }) => ({ label, value: read(report) }))
    .filter((line): line is Line => line.value != null)
    .sort((a, b) => b.value - a.value)

/** Of what the fund's equity is made, as it filed last month.
 *
 *  The indicators say how much the fund is worth; this says of what — and it
 *  is the only monthly source for it, since the itemized filing below is
 *  quarterly and lands months later.
 *
 *  A line the fund filed as zero stays on the table. A fund that reported no
 *  cash at all and one that reported having none are different statements, and
 *  the table is where that distinction is legible: the second has a row.
 */
export default function FIIMonthlyReportCard({ report }: { report: FIIMonthlyReport }) {
  const holdings = useMemo(() => lines(report, PATRIMONY_LINES), [report])
  const liabilities = useMemo(() => lines(report, LIABILITIES), [report])

  /* The shares are read against what the fund says it has invested, not
     against the sum of the rows: a filing that leaves a line out would
     otherwise make the remaining ones add up to 100% of nothing. */
  const invested = report.total_invested

  const columns: AppSimpleTableColumn<Line>[] = [
    { label: 'Onde está', render: (line) => line.label },
    { label: 'Valor', align: 'right', render: (line) => formatBRL(line.value) },
    {
      label: 'Do investido',
      align: 'right',
      hint: 'Quanto esta linha representa do total investido informado pelo fundo',
      render: (line) => (invested ? formatPercent(line.value / invested) : EMPTY),
    },
  ]

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Informe mensal</SectionTitle>
          {report.reference_date && (
            <AppText variant="bodySmall" tone="secondary">
              Informe de {formatDate(report.reference_date)}
            </AppText>
          )}
        </AppStack>

        <AppGrid cols={{ xs: 2, sm: 3, md: 5 }} gap="md">
          <AppMetric label="Total investido" value={formatCompactBRL(report.total_invested)} />
          <AppMetric label="Patrimônio líquido" value={formatCompactBRL(report.equity)} />
          <AppMetric
            label="Taxa de administração"
            value={formatPercent(report.admin_fee_rate)}
            hint="Cobrada no mês do informe, sobre o patrimônio"
          />
          <AppMetric
            label="Rentabilidade patrimonial"
            value={formatPercent(report.monthly_patrimonial_return)}
            hint="Variação do valor patrimonial da cota no mês, sem contar o rendimento distribuído"
          />
          <AppMetric
            label="Amortização"
            value={formatPercent(report.amortization_rate)}
            hint="Devolução de principal no mês. Não é rendimento"
          />
        </AppGrid>

        <AppSimpleTable
          rows={holdings}
          columns={columns}
          getRowKey={(line) => line.label}
          emptyMessage="O informe não detalhou a composição deste mês."
        />

        {liabilities.length > 0 && (
          <AppStack gap="xs">
            <SectionLabel>Passivo</SectionLabel>
            <AppGrid cols={{ xs: 2, sm: 4 }} gap="md">
              {liabilities.map((line) => (
                <AppMetric key={line.label} label={line.label} value={formatBRL(line.value)} />
              ))}
              <AppMetric label="Total" value={formatBRL(report.total_liabilities)} />
            </AppGrid>
          </AppStack>
        )}

        <AppText variant="caption" tone="secondary">
          Valores em reais, como o administrador informou ao regulador.
        </AppText>
      </AppStack>
    </AppCard>
  )
}
