import type { DarfObligation } from '@/api/incomeTax'
import {
  AppCard,
  AppChip,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useState } from 'react'
import DarfPaymentDrawer from './DarfPaymentDrawer'
import { DARF_STATUS, REGIME_LABEL, formatDay, formatMonth, formatTaxValue, money } from './format'

/* Um DARF por código de receita e mês de apuração. Operações comuns e FII
 * pagam pelo mesmo código (6015) e saem na mesma linha; cripto é 4600.
 *
 * "Pago" é o que a pessoa registrou: a apuração não presume pagamento. Abaixo
 * de R$ 10 o DARF não se paga e o valor passa ao mês seguinte do mesmo
 * código — a linha fica, para mostrar de onde veio o acumulado. */

interface Props {
  fiscalYear: number
  obligations: DarfObligation[]
  darfMinimum: string
}

const composition = (obligation: DarfObligation) =>
  obligation.by_regime
    .map((part) => `${REGIME_LABEL[part.regime]} ${formatTaxValue(part.amount)}`)
    .join(' · ')

export default function DarfTable({ fiscalYear, obligations, darfMinimum }: Props) {
  const [selected, setSelected] = useState<DarfObligation | null>(null)

  const columns: AppSimpleTableColumn<DarfObligation>[] = [
    { label: 'Apuração', render: (row) => formatMonth(row.period) },
    { label: 'Código', render: (row) => row.revenue_code },
    { label: 'Composição', width: 'clamped', render: composition },
    {
      label: 'Acumulado',
      hint: `Valores abaixo de ${formatTaxValue(darfMinimum)} de meses anteriores, somados a este.`,
      align: 'right',
      render: (row) => formatTaxValue(row.carried_in),
    },
    { label: 'Valor', align: 'right', render: (row) => formatTaxValue(row.amount) },
    { label: 'Vencimento', render: (row) => formatDay(row.due_date) },
    { label: 'Pago', align: 'right', render: (row) => formatTaxValue(row.paid_principal) },
    {
      label: 'Situação',
      render: (row) => (
        <AppChip label={DARF_STATUS[row.status].label} tone={DARF_STATUS[row.status].tone} />
      ),
    },
  ]

  const open = obligations.reduce((total, obligation) => total + money(obligation.balance), 0)

  return (
    <AppCard>
      <AppStack gap="sm">
        <SectionTitle>{`DARF (${fiscalYear})`}</SectionTitle>
        <AppText variant="bodySmall" tone="secondary">
          {open > 0
            ? `${formatTaxValue(open)} em aberto. Clique num DARF para registrar o pagamento.`
            : 'Clique num DARF para registrar ou conferir o pagamento.'}{' '}
          O vencimento é o último dia útil do mês seguinte; confira no Sicalc, que também calcula
          multa e juros de um DARF em atraso.
        </AppText>
        <AppSimpleTable
          rows={obligations}
          columns={columns}
          getRowKey={(row) => `${row.revenue_code}-${row.period}`}
          onRowClick={setSelected}
          isRowClickable={(row) => row.status !== 'below_minimum' || row.payments.length > 0}
          emptyMessage="Nenhum imposto a pagar no ano."
        />
      </AppStack>
      {selected && (
        <DarfPaymentDrawer
          key={`${selected.revenue_code}-${selected.period}`}
          obligation={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </AppCard>
  )
}
