import { AppCard, AppPageHeaderSkeleton, AppSkeleton, AppStack } from '@/components/ui'

export const SERIES_CHART_HEIGHT = 500

/** A reserva da tela do índice: cabeçalho, e o card do gráfico com a barra de
 *  controles em cima. */
export default function MarketSeriesSkeleton() {
  return (
    <AppStack gap="lg">
      <AppPageHeaderSkeleton />
      <AppCard>
        <AppStack gap="sm">
          <AppSkeleton shape="text" width={90} height={26} />
          <AppSkeleton shape="text" width={260} height={16} />
          <AppStack direction="row" justify="between" align="center" gap="sm" wrap>
            <AppSkeleton shape="text" width={180} height={20} />
            <AppStack direction="row" gap="sm" align="center" wrap>
              <AppSkeleton width={82} height={28} />
              <AppSkeleton width={96} height={28} />
              <AppSkeleton width={64} height={28} />
            </AppStack>
          </AppStack>
          <AppSkeleton height={SERIES_CHART_HEIGHT} />
        </AppStack>
      </AppCard>
    </AppStack>
  )
}
