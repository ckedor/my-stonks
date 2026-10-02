import { AppCard, AppSkeleton, AppStack, AppTableSkeleton } from '@/components/ui'

/** Reserva o espaço da tela de ingestão: o cabeçalho com os botões, o card da
 *  execução em curso com os três números e a tabela do histórico. */
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

      <AppSkeleton height={64} />

      <AppCard>
        <AppStack gap="sm">
          <AppStack direction="row" justify="between" align="center">
            <AppSkeleton shape="text" width={160} height={24} />
            <AppSkeleton shape="pill" width={90} height={24} />
          </AppStack>
          <AppStack direction="row" gap="lg" wrap>
            {Array.from({ length: 3 }).map((_, index) => (
              <AppStack key={index} gap="xs">
                <AppSkeleton shape="text" width={80} height={14} />
                <AppSkeleton shape="text" width={140} height={28} />
              </AppStack>
            ))}
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
