import {
  AppCard,
  AppGrid,
  AppGridItem,
  AppPageHeaderSkeleton,
  AppSkeleton,
  AppStack,
} from '@/components/ui'

/* A reserva da tela de um recorte, na forma em que ela vai chegar: cabeçalho,
 * pizza de concentração à esquerda, grade de cards à direita.
 *
 * Fica ao lado da tela pelo mesmo motivo que ela é uma só — a categoria e os
 * cinco segmentos esperam do mesmo jeito, e uma reserva por página voltaria a
 * ser cinco cópias para manter alinhadas com o layout. */

export interface PortfolioSliceScreenSkeletonProps {
  /** Largura do título em px: o nome do recorte, que varia de "FIIs" a
   *  "Ações/ETFs Mundo". */
  titleWidth?: number
  /** Reserva a linha de descrição sob o título. */
  description?: boolean
  /** Quantos controles à direita do título — o seletor de categoria. */
  actions?: number
}

/** Quantos cards a grade reserva. Seis é o que cabe na dobra sem que a reserva
 *  fique maior que a maioria dos recortes. */
const CARDS = 6

export default function PortfolioSliceScreenSkeleton({
  titleWidth = 160,
  description = false,
  actions = 0,
}: PortfolioSliceScreenSkeletonProps) {
  return (
    <AppStack gap="lg">
      <AppPageHeaderSkeleton
        titleWidth={titleWidth}
        description={description}
        actions={actions}
        metrics={6}
      />

      <AppGrid cols={{ xs: 1, lg: 4 }} gap="lg" align="start">
        <AppGridItem>
          <AppCard>
            <AppSkeleton height={360} />
          </AppCard>
        </AppGridItem>
        <AppGridItem span={{ xs: 1, lg: 3 }}>
          <AppGrid cols={{ xs: 1, sm: 2, lg: 3 }} gap="md">
            {Array.from({ length: CARDS }).map((_, index) => (
              <AppSkeleton key={index} height={150} />
            ))}
          </AppGrid>
        </AppGridItem>
      </AppGrid>
    </AppStack>
  )
}
