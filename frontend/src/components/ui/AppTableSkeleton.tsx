import AppCard from './AppCard'
import AppSkeleton from './AppSkeleton'
import AppStack, { AppStackItem } from './AppStack'

/* A reserva de uma tabela: o cabeçalho e as linhas.
 *
 * Serve as quatro tabelas do design system, porque todas desenham a mesma
 * grade — o que muda entre elas (ordenação, ações, paginação) não ocupa
 * espaço próprio numa linha. Quem chama diz quantas colunas e quantas
 * linhas a tela costuma mostrar, para a reserva ter a altura do conteúdo
 * que vai chegar. */

/** Altura de uma linha de tabela `size="small"`, que é a de todas elas. */
const ROW_HEIGHT = 20

export interface AppTableSkeletonProps {
  columns: number
  /** Padrão: 8. */
  rows?: number
  /** `card` desenha a superfície da tabela; sem isso a reserva assume que
   *  já está dentro de um `AppCard`. Padrão: `none`. */
  surface?: 'none' | 'card'
}

export default function AppTableSkeleton({
  columns,
  rows = 8,
  surface = 'none',
}: AppTableSkeletonProps) {
  const grid = (
    <AppStack gap="md">
      <AppStack direction="row" gap="md">
        {Array.from({ length: columns }).map((_, index) => (
          <AppStackItem key={index}>
            <AppSkeleton shape="text" height={ROW_HEIGHT} />
          </AppStackItem>
        ))}
      </AppStack>

      {Array.from({ length: rows }).map((_, row) => (
        <AppStack key={row} direction="row" gap="md">
          {Array.from({ length: columns }).map((_, column) => (
            <AppStackItem key={column}>
              <AppSkeleton shape="text" height={ROW_HEIGHT} />
            </AppStackItem>
          ))}
        </AppStack>
      ))}
    </AppStack>
  )

  return surface === 'card' ? <AppCard>{grid}</AppCard> : grid
}
