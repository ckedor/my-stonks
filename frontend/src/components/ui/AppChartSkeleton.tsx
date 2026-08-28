import AppCard from './AppCard'
import AppSkeleton from './AppSkeleton'
import AppStack from './AppStack'

/* A reserva de um gráfico: a barra de controles e a área do desenho.
 *
 * A altura vem de quem chama e é a mesma passada ao gráfico — é o que faz
 * a tela não saltar quando a série chega. */

export interface AppChartSkeletonProps {
  height: number | string
  /** Reserva o título à esquerda e os controles à direita, acima da área. */
  toolbar?: boolean
  /** `card` desenha a superfície; sem isso a reserva assume que já está
   *  dentro de um `AppCard`. Padrão: `none`. */
  surface?: 'none' | 'card'
}

export default function AppChartSkeleton({
  height,
  toolbar = false,
  surface = 'none',
}: AppChartSkeletonProps) {
  const content = (
    <AppStack gap="sm">
      {toolbar && (
        <AppStack direction="row" justify="between" align="center" gap="md" wrap>
          <AppSkeleton shape="text" width={160} height={24} />
          <AppStack direction="row" gap="sm" align="center" wrap>
            <AppSkeleton width={82} height={28} />
            <AppSkeleton width={64} height={28} />
            <AppSkeleton width={52} height={28} />
          </AppStack>
        </AppStack>
      )}
      <AppSkeleton height={height} />
    </AppStack>
  )

  return surface === 'card' ? <AppCard>{content}</AppCard> : content
}
