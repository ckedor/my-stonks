import { AppCard, AppSkeleton, AppStack } from '@/components/ui'

/** Placeholder for the market asset page, laid out to match what loads into it:
 *  breadcrumb, ticker heading, then the quote card with its toolbar and chart. */
export default function MarketAssetSkeleton({ height = 500 }: { height?: number }) {
  return (
    <AppStack gap="md">
      {/* Breadcrumbs */}
      <AppStack direction="row" gap="sm" align="center">
        <AppSkeleton shape="text" width={70} height={20} />
        <AppSkeleton shape="text" width={12} height={20} />
        <AppSkeleton shape="text" width={60} height={20} />
      </AppStack>

      <AppStack gap="xs">
        {/* Logo + ticker + etiqueta do tipo */}
        <AppStack direction="row" gap="sm" align="center">
          <AppSkeleton width={28} height={28} />
          <AppSkeleton shape="text" width={110} height={36} />
          <AppSkeleton shape="pill" width={46} height={20} />
        </AppStack>
        <AppSkeleton shape="text" width={240} height={24} />
        {/* CAGR desde o início da série */}
        <AppSkeleton shape="text" width={210} height={20} />
      </AppStack>

      {/* Card da cotação */}
      <AppCard>
        <AppStack gap="sm">
          <AppSkeleton shape="text" width={90} height={26} />

          {/* Barra do gráfico: desempenho à esquerda, controles à direita */}
          <AppStack direction="row" justify="between" align="center" gap="sm" wrap>
            <AppStack direction="row" gap="md">
              <AppSkeleton shape="text" width={130} height={20} />
              <AppSkeleton shape="text" width={90} height={20} />
            </AppStack>
            <AppStack direction="row" gap="sm" align="center" wrap>
              <AppSkeleton shape="text" width={54} height={24} />
              <AppSkeleton shape="text" width={70} height={24} />
              <AppSkeleton width={82} height={28} />
              <AppSkeleton width={96} height={28} />
              <AppSkeleton width={64} height={28} />
              <AppSkeleton width={52} height={28} />
              <AppSkeleton shape="text" width={40} height={24} />
            </AppStack>
          </AppStack>

          <AppSkeleton height={height} />
        </AppStack>
      </AppCard>
    </AppStack>
  )
}
