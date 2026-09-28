import {
  AppGrid,
  AppGridItem,
  AppPageHeaderSkeleton,
  AppSkeleton,
  AppStack,
  AppTableSkeleton,
} from '@/components/ui'

/* A reserva do painel: cabeçalho com métricas, as tabelas de rotinas por
 * grupo, e a faixa de agenda e execuções embaixo. */

export default function IntegrationsDashboardSkeleton() {
  return (
    <AppStack gap="lg">
      <AppPageHeaderSkeleton breadcrumbs={false} actions={1} description metrics={6} />
      <AppStack gap="md">
        <AppSkeleton shape="text" width={160} height={28} />
        <AppTableSkeleton rows={4} columns={6} surface="card" />
        <AppTableSkeleton rows={5} columns={6} surface="card" />
      </AppStack>
      <AppGrid cols={{ xs: 1, lg: 3 }} gap="lg">
        <AppGridItem>
          <AppSkeleton height={240} />
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 2 }}>
          <AppTableSkeleton rows={6} columns={6} surface="card" />
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}
