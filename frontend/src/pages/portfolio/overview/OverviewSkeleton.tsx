import { AppGrid, AppGridItem, AppSkeleton, AppStack, AppStackItem } from '@/components/ui'

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

/** Reserva o espaço da visão geral: o bloco de patrimônio, a linha de gráficos
 *  e a linha da lista de categorias com o gráfico ao lado. */
export default function OverviewSkeleton() {
  return (
    <AppStack gap="lg">
      {/* Hero */}
      <AppStack gap="xs">
        <AppSkeleton shape="text" width={90} height={20} />
        <AppSkeleton shape="text" width={220} height={42} />
        <AppSkeleton shape="text" width={160} height={20} />
      </AppStack>

      {/* Gráfico de rentabilidade + pizza */}
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="md">
        <AppGridItem span={{ xs: 1, lg: 8 }}>
          <AppSkeleton height={360} />
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 4 }}>
          <AppSkeleton height={360} />
        </AppGridItem>
      </AppGrid>

      {/* Lista de categorias + gráfico da aba de baixo */}
      <AppGrid cols={{ xs: 1, lg: 12 }} gap="md" align="start">
        <AppGridItem span={{ xs: 1, lg: 5 }}>
          <AppStack gap="md">
            {Array.from({ length: 5 }).map((_, i) => (
              <CategoryRowSkeleton key={i} />
            ))}
          </AppStack>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 7 }}>
          <AppStack gap="sm">
            <AppStack direction="row" gap="sm">
              <AppSkeleton width={70} height={24} />
              <AppSkeleton width={80} height={24} />
            </AppStack>
            <AppSkeleton height={320} />
          </AppStack>
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}
