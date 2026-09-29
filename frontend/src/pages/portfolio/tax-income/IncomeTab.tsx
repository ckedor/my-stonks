import type { IncomeLine } from '@/api/incomeTax'
import {
  AppCard,
  AppCopyField,
  AppEmptyState,
  AppGrid,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import FormAmount from './FormAmount'

/* Rendimentos Isentos e Rendimentos Sujeitos à Tributação Exclusiva: a mesma
 * forma de ficha — tipo de rendimento, beneficiário, fonte pagadora, valor —,
 * uma linha por fonte pagadora. Os ganhos isentos do ano (código 20 das ações,
 * 05 da cripto) não têm fonte e saem numa linha só. */

function IncomeCard({ line }: { line: IncomeLine }) {
  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack gap="xs">
          <SectionLabel>{`${line.code} – ${line.code_name}`}</SectionLabel>
          {line.note && (
            <AppText variant="bodySmall" tone="caution">
              {line.note}
            </AppText>
          )}
        </AppStack>
        <AppGrid cols={{ xs: 1, sm: 2, md: 4 }} gap="md">
          <AppCopyField label="Tipo de rendimento" value={line.code} />
          <AppCopyField label="Beneficiário" value="Titular" />
          {line.payer_name !== null && (
            <AppCopyField label="CNPJ da fonte pagadora" value={line.payer_cnpj ?? ''} />
          )}
          {line.payer_name !== null && (
            <AppCopyField label="Nome da fonte pagadora" value={line.payer_name} />
          )}
          <FormAmount label="Valor (R$)" value={line.amount} />
        </AppGrid>
      </AppStack>
    </AppCard>
  )
}

interface Props {
  title: string
  description: string
  lines: IncomeLine[]
  emptyMessage: string
}

export default function IncomeTab({ title, description, lines, emptyMessage }: Props) {
  if (lines.length === 0) {
    return <AppEmptyState size="section" title={emptyMessage} description={description} />
  }
  return (
    <AppStack gap="md">
      <SectionTitle>{title}</SectionTitle>
      <AppText variant="bodySmall" tone="secondary">
        {description}
      </AppText>
      {lines.map((line) => (
        <IncomeCard key={`${line.code}-${line.payer_cnpj}-${line.payer_name}`} line={line} />
      ))}
    </AppStack>
  )
}
