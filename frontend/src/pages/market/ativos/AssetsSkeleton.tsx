import {
  AppCard,
  AppGrid,
  AppPageHeaderSkeleton,
  AppSkeleton,
  AppStack,
  AppTableSkeleton,
} from '@/components/ui'

/** A reserva da tela de ativos, no desenho dela: os acessados em cima, os principais de cada categoria, e o screener. */
export default function AssetsSkeleton() {
  return (
    <AppStack gap="xl">
      <AppPageHeaderSkeleton titleWidth={120} description />
      <AppSkeleton height={330} />
      <AppStack gap="md">
        <AppStack gap="xs">
          <AppSkeleton shape="text" width={150} height={16} />
          <AppSkeleton shape="text" width={260} height={26} />
        </AppStack>
        <AppGrid cols={{ xs: 1, md: 2, lg: 3 }} gap="md">
          {[0, 1, 2, 3, 4, 5].map((card) => (
            <AppSkeleton key={card} height={330} />
          ))}
        </AppGrid>
      </AppStack>
      <AppCard>
        <AppTableSkeleton columns={6} rows={10} />
      </AppCard>
    </AppStack>
  )
}
