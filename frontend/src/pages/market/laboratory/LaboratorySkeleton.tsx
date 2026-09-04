import {
  AppCard,
  AppChartSkeleton,
  AppGrid,
  AppGridItem,
  AppPageHeaderSkeleton,
  AppSkeleton,
  AppStack,
  AppTableSkeleton,
} from '@/components/ui'

/* A reserva da bancada.
 *
 * Ocupa o espaço final da tela, então nada salta quando o dado chega. Anda
 * junto do desenho: mudou a bancada, muda isto no mesmo commit. */
export default function LaboratorySkeleton() {
  return (
    <AppStack gap="lg">
      <AppPageHeaderSkeleton titleWidth={160} />
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="lg">
        <AppGridItem span={{ xs: 1, lg: 4 }}>
          <AppStack gap="md">
            <AppCard>
              <AppStack gap="sm">
                <AppSkeleton height={36} />
                <AppSkeleton height={36} />
                <AppSkeleton height={36} />
              </AppStack>
            </AppCard>
            <AppCard>
              <AppTableSkeleton columns={3} rows={4} />
            </AppCard>
          </AppStack>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 8 }}>
          <AppStack gap="md">
            <AppCard>
              <AppChartSkeleton height={260} />
            </AppCard>
            <AppCard>
              <AppStack gap="sm">
                <AppSkeleton height={36} />
                <AppSkeleton height={36} />
              </AppStack>
            </AppCard>
          </AppStack>
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}
