import type { RegimeAssessment } from '@/api/incomeTax'
import { AppCard, AppGrid, AppStack, AppText, SectionTitle } from '@/components/ui'
import FormAmount from './FormAmount'
import { money } from './format'

/* Imposto Pago/Retido: o IRRF das vendas em bolsa que sobrou no ano.
 *
 * O "dedo-duro" retido e não abatido nos meses do ano não se perde: entra na
 * declaração como imposto já pago. Os DARFs de renda variável não entram aqui
 * — eles vão no campo "imposto pago" de cada mês da ficha Renda Variável. */

export default function TaxesPaidTab({ regimes }: { regimes: RegimeAssessment[] }) {
  const total = regimes
    .filter((regime) => regime.regime !== 'crypto')
    .reduce((sum, regime) => sum + money(regime.withheld_to_declare), 0)

  return (
    <AppCard>
      <AppStack gap="md">
        <SectionTitle>Imposto Pago/Retido</SectionTitle>
        <AppText variant="bodySmall" tone="secondary">
          IRRF das vendas em bolsa (0,005%) que não foi abatido de imposto no ano. Confira se o
          programa já não o trouxe da ficha Renda Variável antes de digitar.
        </AppText>
        <AppGrid cols={{ xs: 1, sm: 2 }} gap="md">
          <FormAmount
            label="Imposto sobre a renda na fonte (Lei 11.033/2004)"
            value={total.toFixed(2)}
          />
        </AppGrid>
      </AppStack>
    </AppCard>
  )
}
