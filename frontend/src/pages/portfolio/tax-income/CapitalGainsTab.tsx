import type { CapitalGainOperation, RealizedSale, RegimeAssessment } from '@/api/incomeTax'
import {
  AppCard,
  AppCopyField,
  AppGrid,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import FormAmount from './FormAmount'
import RegimeTable from './RegimeTable'
import { formatDay } from './format'

/* Ganhos de Capital: as vendas de cripto dos meses que passaram de R$ 35 mil.
 *
 * Elas são lançadas no programa GCAP, uma operação por venda, e o GCAP é
 * importado depois pela declaração. Nos meses isentos o ganho vai para
 * Rendimentos Isentos (código 05), e não aparece aqui. */

function OperationCard({ operation }: { operation: CapitalGainOperation }) {
  return (
    <AppCard>
      <AppStack gap="md">
        <SectionLabel>{`${formatDay(operation.day)} · ${operation.ticker}`}</SectionLabel>
        <AppGrid cols={{ xs: 1, sm: 2, md: 3 }} gap="md">
          <AppCopyField label="Data da alienação" value={formatDay(operation.day)} />
          <AppCopyField
            label="Especificação"
            value={`${operation.quantity.replace('.', ',')} ${operation.ticker}`}
          />
          <FormAmount label="Valor de alienação (R$)" value={operation.sale_value} />
          <FormAmount label="Custo de aquisição (R$)" value={operation.acquisition_cost} />
          <FormAmount label="Custos da venda (R$)" value={operation.fees} />
          <FormAmount label="Ganho de capital (R$)" value={operation.capital_gain} />
        </AppGrid>
      </AppStack>
    </AppCard>
  )
}

interface Props {
  operations: CapitalGainOperation[]
  regime: RegimeAssessment
  sales: RealizedSale[]
  fiscalYear: number
}

export default function CapitalGainsTab({ operations, regime, sales, fiscalYear }: Props) {
  return (
    <AppStack gap="lg">
      <AppStack gap="md">
        <SectionTitle>{`Ganhos de Capital — GCAP (${operations.length})`}</SectionTitle>
        <AppText variant="bodySmall" tone="secondary">
          {operations.length > 0
            ? 'Cada venda de criptoativo de um mês com mais de R$ 35 mil em vendas é uma operação no GCAP. A perda de uma venda não abate o ganho de outra.'
            : 'Nenhuma venda de criptoativo em mês acima de R$ 35 mil: não há o que lançar no GCAP.'}
        </AppText>
        {operations.map((operation) => (
          <OperationCard key={operation.transaction_id} operation={operation} />
        ))}
      </AppStack>
      <RegimeTable regime={regime} sales={sales} fiscalYear={fiscalYear} />
    </AppStack>
  )
}
