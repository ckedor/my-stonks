import { AppChartSkeleton, AppPageHeaderSkeleton, AppStack } from '@/components/ui'

/** Reserva da página enquanto o módulo da rota é baixado. */
export default function RouteSkeleton() {
  return (
    <AppStack gap="lg">
      <AppPageHeaderSkeleton />
      <AppChartSkeleton height={360} surface="card" />
    </AppStack>
  )
}
