import { AppCard, AppSkeleton, AppStack, AppTableSkeleton } from '@/components/ui'

/* A reserva das três abas da declaração, que mostram a mesma coisa: um card
 * com o título do quadro e a tabela que a Receita quer. Muda só a largura da
 * grade, então é a única prop além do número de linhas. */

export interface TaxTableSkeletonProps {
  columns: number
  /** Padrão: 12, um ano de linhas mensais. */
  rows?: number
}

export default function TaxTableSkeleton({ columns, rows = 12 }: TaxTableSkeletonProps) {
  return (
    <AppCard>
      <AppStack gap="sm">
        <AppSkeleton shape="text" width={260} height={24} />
        <AppTableSkeleton columns={columns} rows={rows} />
      </AppStack>
    </AppCard>
  )
}
