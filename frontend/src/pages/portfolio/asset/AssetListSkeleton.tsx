import { AppSkeleton, AppStack, AppStackItem } from '@/components/ui'

/* Reserva o espaço da listagem: a barra de filtros e três grupos de ativos,
 * cada um com o cabeçalho e as linhas da tabela. */

function RowSkeleton() {
  return (
    <AppStack direction="row" gap="sm" align="center">
      <AppSkeleton shape="circle" width={32} height={32} />
      <AppStackItem grow={2}>
        <AppSkeleton shape="text" width={160} height={18} />
        <AppSkeleton shape="text" width={110} height={14} />
      </AppStackItem>
      {Array.from({ length: 5 }).map((_, i) => (
        <AppStackItem key={i}>
          <AppSkeleton shape="text" height={18} />
        </AppStackItem>
      ))}
      <AppStackItem width={160}>
        <AppSkeleton height={32} />
      </AppStackItem>
    </AppStack>
  )
}

function GroupSkeleton({ rows }: { rows: number }) {
  return (
    <AppStack gap="sm">
      <AppStack direction="row" gap="sm" align="center">
        <AppSkeleton width={6} height={20} />
        <AppSkeleton shape="text" width={120} height={22} />
        <AppStackItem />
        <AppSkeleton shape="text" width={100} height={22} />
      </AppStack>

      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} />
      ))}
    </AppStack>
  )
}

export default function AssetListSkeleton() {
  return (
    <AppStack gap="lg">
      <AppStack direction="row" gap="md" align="center">
        <AppSkeleton width={400} height={40} />
        <AppSkeleton width={200} height={40} />
        <AppStackItem />
        <AppSkeleton width={160} height={40} />
      </AppStack>

      <AppStack gap="lg">
        <GroupSkeleton rows={5} />
        <GroupSkeleton rows={4} />
        <GroupSkeleton rows={3} />
      </AppStack>
    </AppStack>
  )
}
