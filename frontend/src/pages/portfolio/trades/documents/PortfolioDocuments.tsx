import {
  AppCard,
  AppSnackbar,
  AppStack,
  AppTableSkeleton,
  AppText,
  SectionTitle,
} from '@/components/ui'
import { EMPTY_LIST } from '@/queries/empty'
import { usePortfolioDocuments } from '@/queries/portfolioDocument'
import { useState } from 'react'
import DocumentsTable from './DocumentsTable'
import { useOpenPortfolioDocument } from './useOpenPortfolioDocument'

/* Aba "Documentos" de Trades.
 *
 * Todo PDF enviado para ler uma nota ou bater a posição fica guardado como
 * chegou, mesmo quando a leitura falhou ou nenhuma nota foi confirmada. O
 * mesmo arquivo enviado de novo é o mesmo documento. */
export default function PortfolioDocuments() {
  const { data, isPending } = usePortfolioDocuments()
  const documents = data ?? EMPTY_LIST
  const [error, setError] = useState<string | null>(null)
  const openDocument = useOpenPortfolioDocument(setError)

  return (
    <AppStack gap="md">
      <SectionTitle>PDFs enviados</SectionTitle>
      <AppText variant="bodySmall" tone="secondary">
        As notas de corretagem e os extratos de posição enviados a esta carteira, do mais recente ao
        mais antigo.
      </AppText>
      {isPending ? (
        <AppCard padding="md">
          <AppTableSkeleton columns={6} rows={4} />
        </AppCard>
      ) : (
        <DocumentsTable documents={documents} onOpen={openDocument.open} />
      )}
      <AppSnackbar
        open={error !== null}
        message={error ?? ''}
        severity="error"
        onClose={() => setError(null)}
      />
    </AppStack>
  )
}
