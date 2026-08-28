import { AppCard, AppChartSkeleton, AppSkeleton, AppStack } from '@/components/ui'

/** Reserva o espaço de `RiskAnalysisCards`: o card das métricas e o do
 *  drawdown. Anda junto dele — mudou o quadro de risco, muda a reserva. */
export default function RiskAnalysisCardsSkeleton({
  drawdownSize = 350,
}: {
  drawdownSize?: number
}) {
  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack gap="md">
          <AppSkeleton shape="text" width={200} height={24} />
          <AppStack direction="row" gap="lg" wrap>
            {Array.from({ length: 8 }).map((_, index) => (
              <AppStack key={index} gap="none">
                <AppSkeleton shape="text" width={110} height={16} />
                <AppSkeleton shape="text" width={80} height={24} />
              </AppStack>
            ))}
          </AppStack>
        </AppStack>
      </AppCard>

      <AppChartSkeleton height={drawdownSize} toolbar surface="card" />
    </AppStack>
  )
}
