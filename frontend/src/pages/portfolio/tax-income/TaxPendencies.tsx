import type { TaxPendency } from '@/api/incomeTax'
import { AppBulletList, AppCard, AppStack, AppText, SectionTitle } from '@/components/ui'
import { formatDay } from './format'

/* O que a apuração não decidiu sozinha. Cada pendência diz a premissa usada e
 * o que fazer: o número sai mesmo assim, e é por isso que ela fica acima das
 * abas — quem lê um DARF precisa saber antes se ele depende de uma. */

export default function TaxPendencies({ pendencies }: { pendencies: TaxPendency[] }) {
  if (pendencies.length === 0) return null

  return (
    <AppCard>
      <AppStack gap="sm">
        <SectionTitle>{`Pendências (${pendencies.length})`}</SectionTitle>
        <AppText variant="bodySmall" tone="secondary">
          A apuração saiu com as premissas abaixo. Resolva-as no cadastro ou nas negociações e a
          tela se refaz.
        </AppText>
        <AppBulletList
          tone="default"
          items={pendencies.map((pendency) =>
            pendency.day ? `${formatDay(pendency.day)} — ${pendency.message}` : pendency.message
          )}
        />
      </AppStack>
    </AppCard>
  )
}
