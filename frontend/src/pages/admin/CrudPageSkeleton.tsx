import { AppSkeleton, AppStack, AppTableSkeleton } from '@/components/ui'

/* A reserva das telas de cadastro do admin, que são todas a mesma tela:
 * título, botão de criar, busca e tabela.
 *
 * Fica aqui e não em cada página porque a forma é uma só — mudou o desenho
 * da tela de cadastro, muda a reserva junto. */

export interface CrudPageSkeletonProps {
  /** Colunas da tabela, contando a de ações. */
  columns: number
  /** Padrão: 8. */
  rows?: number
  /** Reserva o botão de criar, à direita do título. Padrão: `true`. */
  action?: boolean
  /** Reserva a busca acima da tabela. Padrão: `true`. */
  search?: boolean
  /** Reserva o parágrafo que explica a tela, entre o título e a tabela. */
  description?: boolean
}

export default function CrudPageSkeleton({
  columns,
  rows = 8,
  action = true,
  search = true,
  description = false,
}: CrudPageSkeletonProps) {
  return (
    <AppStack gap="lg">
      <AppStack direction="row" justify="between" align="center">
        <AppSkeleton shape="text" width={280} height={40} />
        {action && <AppSkeleton width={160} height={40} />}
      </AppStack>

      {description && (
        <AppStack gap="xs">
          <AppSkeleton shape="text" height={16} />
          <AppSkeleton shape="text" height={16} />
          <AppSkeleton shape="text" width={420} height={16} />
        </AppStack>
      )}

      <AppStack gap="md">
        {search && <AppSkeleton height={48} />}
        <AppTableSkeleton columns={columns} rows={rows} surface="card" />
      </AppStack>
    </AppStack>
  )
}
