import { AppPageHeaderSkeleton, AppSkeleton, AppStack } from '@/components/ui'
import TaxTableSkeleton from './TaxTableSkeleton'

/* A reserva da tela de IR: cabeçalho com o seletor de ano e as quatro
 * métricas, a fileira de abas e o quadro do DARF. */

export default function TaxIncomeSkeleton() {
  return (
    <AppStack gap="lg">
      <AppPageHeaderSkeleton titleWidth={180} actions={1} metrics={4} />
      <AppSkeleton shape="text" width={520} height={40} />
      <TaxTableSkeleton columns={8} rows={6} />
    </AppStack>
  )
}
