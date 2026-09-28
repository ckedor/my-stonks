import {
  AppCard,
  AppGrid,
  AppGridItem,
  AppSkeleton,
  AppStack,
  AppStackItem,
} from '@/components/ui'

function CategoryRowSkeleton() {
  return (
    <AppStack direction="row" gap="sm" align="center">
      <AppSkeleton shape="circle" width={40} height={40} />
      <AppStackItem>
        <AppSkeleton shape="text" width={180} height={20} />
      </AppStackItem>
      <AppStack gap="none" align="end">
        <AppSkeleton shape="text" width={80} height={18} />
        <AppSkeleton shape="text" width={50} height={14} />
      </AppStack>
    </AppStack>
  )
}

/** Reserva o espaço do resumo: o patrimônio no topo, a linha de
 *  gráficos e a linha da lista de categorias com o gráfico ao lado — cada
 *  bloco no card em que ele chega. */
export default function OverviewSkeleton() {
  return (
    <AppStack gap="lg">
      {/* Patrimônio e CAGR */}
      <AppStack gap="xs">
        <AppSkeleton shape="text" width={90} height={20} />
        <AppSkeleton shape="text" width={220} height={42} />
        <AppSkeleton shape="text" width={160} height={20} />
      </AppStack>

      {/* Rentabilidade + composição */}
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="md">
        <AppGridItem span={{ xs: 1, lg: 8 }}>
          <AppCard>
            <AppStack gap="sm">
              <AppSkeleton shape="text" width={120} height={26} />
              <AppSkeleton height={360} />
            </AppStack>
          </AppCard>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 4 }}>
          <AppCard>
            <AppStack gap="sm">
              <AppSkeleton shape="text" width={120} height={26} />
              <AppSkeleton height={360} />
            </AppStack>
          </AppCard>
        </AppGridItem>
      </AppGrid>

      {/* Categorias + gráfico da aba de baixo */}
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="md" align="start">
        <AppGridItem span={{ xs: 1, lg: 5 }}>
          <AppCard>
            <AppStack gap="md">
              <AppSkeleton shape="text" width={120} height={26} />
              {Array.from({ length: 5 }).map((_, i) => (
                <CategoryRowSkeleton key={i} />
              ))}
            </AppStack>
          </AppCard>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 7 }}>
          <AppCard>
            <AppStack gap="sm">
              <AppStack direction="row" gap="sm">
                <AppSkeleton width={70} height={24} />
                <AppSkeleton width={80} height={24} />
              </AppStack>
              <AppSkeleton height={320} />
            </AppStack>
          </AppCard>
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}
