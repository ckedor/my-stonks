import type { TerritoryStage } from '@/components/city-game/territory'
import type { CityTier } from '@/components/city-game/tiers'
import { AppDialog, AppStack, AppText } from '@/components/ui'

const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** O anúncio de uma expansão do território — raro, e por isso com festa.
 *  Abre quando a patente abriu uma área que o jogador ainda não viu, e
 *  fechar é o que a marca como vista. */
export default function TerritoryDialog({ areas, next, onClose }: {
  areas: TerritoryStage[]
  next: { stage: TerritoryStage; tier: CityTier } | null
  onClose: () => void
}) {
  const names = areas.map(area => area.name)
  const listed = names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names.at(-1)}` : names[0]
  return (
    <AppDialog open={areas.length > 0} title="Nova área liberada!" closeLabel="Explorar" onClose={onClose}>
      <AppStack gap="md">
        <AppText>
          Sua patente abriu {areas.length > 1 ? 'as áreas' : 'a área'} <strong>{listed}</strong>: agora dá para construir lá.
        </AppText>
        <AppText variant="bodySmall" tone="secondary">
          {next
            ? `A próxima, ${next.stage.name}, abre quando você chegar a ${next.tier.name} (${usd.format(next.tier.thresholdUsd)} de patrimônio).`
            : 'O mapa inteiro é seu.'}
        </AppText>
      </AppStack>
    </AppDialog>
  )
}
