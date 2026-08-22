import { AppDivider, AppSkeleton, AppStack } from '@/components/ui'

function MetricSkeleton() {
  return (
    <AppStack>
      <AppSkeleton shape="text" width={56} height={14} />
      <AppSkeleton shape="text" width={84} height={24} />
    </AppStack>
  )
}

/** Reserva o espaço do que `AssetDetailPanel` desenha: header, abas e o primeiro
 *  card da aba. Se o header mudar de forma, esta reserva muda junto — senão o
 *  conteúdo salta quando os dados chegam. */
export default function AssetDetailPanelSkeleton() {
  return (
    <AppStack gap="lg">
      <AppStack gap="lg">
        <AppStack gap="xs">
          <AppStack direction="row" gap="sm" align="center">
            <AppSkeleton shape="text" width={130} height={48} />
            <AppSkeleton shape="pill" width={44} height={22} />
          </AppStack>
          <AppSkeleton shape="text" width={240} height={24} />
        </AppStack>

        <AppStack direction="row" justify="between" align="end" gap="md" wrap>
          <AppStack gap="xs">
            <AppSkeleton shape="text" width={60} height={18} />
            <AppStack direction="row" gap="sm" align="baseline">
              <AppSkeleton shape="text" width={150} height={34} />
              <AppSkeleton shape="text" width={90} height={24} />
            </AppStack>
          </AppStack>
          <AppStack direction="row" gap="sm">
            <AppSkeleton width={110} height={32} />
            <AppSkeleton width={110} height={32} />
            <AppSkeleton width={32} height={32} />
          </AppStack>
        </AppStack>

        <AppStack direction="row" gap="lg" wrap>
          {Array.from({ length: 6 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </AppStack>
      </AppStack>

      <AppDivider />

      <AppStack direction="row" gap="lg" align="center">
        {Array.from({ length: 4 }).map((_, i) => (
          <AppSkeleton key={i} shape="text" width={80} height={24} />
        ))}
      </AppStack>

      <AppStack gap="lg">
        <AppSkeleton height={410} />
        <AppSkeleton height={470} />
      </AppStack>
    </AppStack>
  )
}
