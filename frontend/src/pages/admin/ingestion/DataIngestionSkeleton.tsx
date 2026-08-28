import { AppCard, AppSkeleton, AppStack, AppTableSkeleton } from '@/components/ui'

/** Reserva o espaço da tela de ingestão: o cabeçalho com os botões, os três
 *  cards de números, o card da execução em curso e a tabela do histórico. */
export default function DataIngestionSkeleton() {
  return (
    <AppStack gap="lg">
      <AppStack direction="row" justify="between" align="center" gap="md" collapseBelow="md">
        <AppStack gap="xs">
          <AppSkeleton shape="text" width={300} height={40} />
          <AppSkeleton shape="text" width={420} height={16} />
        </AppStack>
        <AppStack direction="row" gap="sm" collapseBelow="sm">
          <AppSkeleton width={120} height={40} />
          <AppSkeleton width={180} height={40} />
          <AppSkeleton width={150} height={40} />
        </AppStack>
      </AppStack>

      <AppStack direction="row" gap="md" wrap collapseBelow="sm">
        {Array.from({ length: 3 }).map((_, index) => (
          <AppSkeleton key={index} width={240} height={96} />
        ))}
      </AppStack>

      <AppCard>
        <AppStack gap="sm">
          <AppStack direction="row" justify="between" align="center">
            <AppSkeleton shape="text" width={160} height={24} />
            <AppSkeleton shape="pill" width={90} height={24} />
          </AppStack>
          <AppSkeleton height={8} />
          <AppSkeleton shape="text" width={420} height={16} />
        </AppStack>
      </AppCard>

      <AppStack gap="sm">
        <AppStack direction="row" justify="between" align="baseline">
          <AppSkeleton shape="text" width={200} height={24} />
          <AppSkeleton shape="text" width={180} height={16} />
        </AppStack>
        <AppTableSkeleton columns={8} rows={6} surface="card" />
      </AppStack>
    </AppStack>
  )
}
