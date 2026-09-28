import { AppCard, AppGrid, AppGridItem, AppSkeleton, AppStack } from '@/components/ui'

function CardSkeleton() {
  return (
    <AppCard>
      <AppStack gap="sm">
        <AppSkeleton shape="text" width={80} height={18} />
        <AppSkeleton shape="text" width={140} height={32} />
        <AppSkeleton height={120} />
        <AppSkeleton shape="text" width={160} height={18} />
      </AppStack>
    </AppCard>
  )
}

/** A reserva da aba Mundo: o mundo em destaque ao lado das cotações e do
 *  ranking, e a fileira dos cinco recortes embaixo. */
export default function WorldSkeleton() {
  return (
    <AppStack gap="xl">
      <AppStack gap="xs">
        <AppSkeleton shape="text" width={150} height={16} />
        <AppSkeleton shape="text" width={300} height={26} />
      </AppStack>
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="lg" align="start">
        <AppGridItem span={{ xs: 1, lg: 7 }}>
          <AppCard padding="lg">
            <AppStack gap="md">
              <AppSkeleton shape="text" width={160} height={26} />
              <AppSkeleton shape="text" width={360} height={40} />
              <AppSkeleton height={420} />
            </AppStack>
          </AppCard>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 5 }}>
          <AppStack gap="md">
            <AppGrid cols={{ xs: 2 }} gap="md">
              {[0, 1, 2, 3].map((quote) => (
                <AppCard key={quote}>
                  <AppStack gap="sm">
                    <AppSkeleton shape="text" width={110} height={40} />
                    <AppSkeleton shape="text" width={160} height={34} />
                  </AppStack>
                </AppCard>
              ))}
            </AppGrid>
            <AppCard padding="lg">
              <AppStack gap="md">
                <AppSkeleton shape="text" width={140} height={18} />
                <AppSkeleton height={290} />
              </AppStack>
            </AppCard>
          </AppStack>
        </AppGridItem>
      </AppGrid>
      <AppGrid cols={{ xs: 1, sm: 2, md: 3, lg: 5 }} gap="md">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </AppGrid>
    </AppStack>
  )
}
