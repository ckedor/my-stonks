import AppCard from './AppCard'
import AppSkeleton from './AppSkeleton'
import AppStack from './AppStack'

/* A reserva do `AppPageHeader`, com a mesma ordem: rastro, título, ações,
 * métricas.
 *
 * Existe aqui, e não copiado em cada tela, porque o cabeçalho é o mesmo em
 * toda página: se o header mudar de forma, a reserva muda junto num lugar
 * só. Quem chama diz apenas o que a própria tela preenche — sem métricas,
 * o card de métricas não é reservado, senão a tela salta ao carregar. */

export interface AppPageHeaderSkeletonProps {
  /** Padrão: `true`, como na maioria das telas, que estão dentro de uma seção. */
  breadcrumbs?: boolean
  /** Largura do título em px. Padrão: 220. */
  titleWidth?: number
  /** Quantos controles à direita do título. Padrão: nenhum. */
  actions?: number
  /** Reserva a linha de descrição sob o título. */
  description?: boolean
  /** Quantas métricas no card sob o título. Padrão: nenhuma, e sem card. */
  metrics?: number
}

export default function AppPageHeaderSkeleton({
  breadcrumbs = true,
  titleWidth = 220,
  actions = 0,
  description = false,
  metrics = 0,
}: AppPageHeaderSkeletonProps) {
  return (
    <AppStack gap="sm">
      {breadcrumbs && (
        <AppStack direction="row" gap="sm" align="center">
          <AppSkeleton shape="text" width={70} height={20} />
          <AppSkeleton shape="text" width={12} height={20} />
          <AppSkeleton shape="text" width={90} height={20} />
        </AppStack>
      )}

      <AppStack direction="row" align="start" justify="between" gap="md" wrap>
        <AppSkeleton shape="text" width={titleWidth} height={40} />
        {actions > 0 && (
          <AppStack direction="row" align="center" justify="end" gap="sm" wrap>
            {Array.from({ length: actions }).map((_, index) => (
              <AppSkeleton key={index} width={140} height={40} />
            ))}
          </AppStack>
        )}
      </AppStack>

      {description && <AppSkeleton shape="text" width={420} height={20} />}

      {metrics > 0 && (
        <AppCard>
          <AppStack direction="row" gap="lg" wrap>
            {Array.from({ length: metrics }).map((_, index) => (
              <AppStack key={index} gap="none">
                <AppSkeleton shape="text" width={index === 0 ? 96 : 120} height={16} />
                <AppSkeleton shape="text" width={index === 0 ? 150 : 96} height={index === 0 ? 30 : 24} />
              </AppStack>
            ))}
          </AppStack>
        </AppCard>
      )}
    </AppStack>
  )
}
