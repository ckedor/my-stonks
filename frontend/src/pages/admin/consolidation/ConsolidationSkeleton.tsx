import { AppCard, AppSkeleton, AppStack } from '@/components/ui'

/** Reserva o espaço da tela de consolidação: o título e os dois cards de
 *  operação, cada um com o nome, a explicação e os controles. */
export default function ConsolidationSkeleton() {
  return (
    <AppStack gap="lg">
      <AppSkeleton shape="text" width={240} height={40} />

      <AppCard padding="lg">
        <AppStack gap="md">
          <AppStack gap="xs">
            <AppSkeleton shape="text" width={280} height={24} />
            <AppSkeleton shape="text" width={520} height={16} />
          </AppStack>
          <AppSkeleton width={280} height={40} />
        </AppStack>
      </AppCard>

      <AppCard padding="lg">
        <AppStack gap="md">
          <AppStack gap="xs">
            <AppSkeleton shape="text" width={200} height={24} />
            <AppSkeleton shape="text" width={420} height={16} />
          </AppStack>
          <AppStack direction="row" gap="md" align="start" wrap>
            <AppSkeleton width={220} height={48} />
            <AppSkeleton width={320} height={48} />
            <AppSkeleton width={140} height={40} />
          </AppStack>
        </AppStack>
      </AppCard>
    </AppStack>
  )
}
