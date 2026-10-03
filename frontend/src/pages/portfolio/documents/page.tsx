import type { DocumentKind } from '@/api/portfolioDocument'
import {
  AppButton,
  AppCard,
  AppEmptyState,
  AppPageHeader,
  AppSkeleton,
  AppSnackbar,
  AppStack,
} from '@/components/ui'
import { useOpenPortfolioDocument } from '@/hooks/useOpenPortfolioDocument'
import { EMPTY_LIST } from '@/queries/empty'
import { usePortfolioDocuments } from '@/queries/portfolioDocument'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DocumentList from './DocumentList'
import KindCards from './KindCards'
import { DOCUMENT_KIND } from './kinds'

/* Os arquivos enviados à carteira, de todo tipo.
 *
 * Tela própria, e não uma aba de Trades: as notas e os extratos chegam pelas
 * telas de Trades, mas o lugar onde se procura o que foi enviado não pode
 * depender de onde cada tipo entra — o próximo tipo (o informe de
 * rendimentos) não é operação nenhuma.
 *
 * Todo PDF enviado fica guardado como chegou, mesmo quando a leitura falhou
 * ou nenhuma nota foi confirmada. O mesmo arquivo enviado de novo, para o
 * mesmo fim, é o mesmo documento. */

/** A reserva da lista: um mês com três arquivos. */
function DocumentListSkeleton() {
  return (
    <AppCard padding="md">
      <AppStack gap="md">
        <AppSkeleton width={120} height={14} shape="text" />
        {[0, 1, 2].map((row) => (
          <AppStack key={row} direction="row" gap="md" align="center">
            <AppSkeleton width={24} height={28} shape="rounded" />
            <AppStack gap="xs" grow>
              <AppSkeleton width="40%" height={18} shape="text" />
              <AppSkeleton width="25%" height={14} shape="text" />
            </AppStack>
          </AppStack>
        ))}
      </AppStack>
    </AppCard>
  )
}

export default function PortfolioDocumentsPage() {
  const navigate = useNavigate()
  const { data, isPending } = usePortfolioDocuments()
  const documents = data ?? EMPTY_LIST
  const [kind, setKind] = useState<DocumentKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const openDocument = useOpenPortfolioDocument(setError)

  const shown = useMemo(
    () => (kind === null ? documents : documents.filter((document) => document.kind === kind)),
    [documents, kind]
  )

  const importNote = (
    <AppButton icon={<ReceiptLongOutlinedIcon fontSize="small" />} onClick={() => navigate('/portfolio/trades?tab=import')}>
      Importar nota
    </AppButton>
  )
  const checkPosition = (
    <AppButton
      emphasis="outline"
      icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />}
      onClick={() => navigate('/portfolio/trades?tab=position')}
    >
      Bater posição
    </AppButton>
  )

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Documentos"
        breadcrumbs={[{ label: 'Carteira', href: '/portfolio/overview' }, { label: 'Documentos' }]}
        // Sem arquivo nenhum, os dois caminhos ficam no vazio, que é onde se
        // olha; repeti-los aqui seria a mesma escolha duas vezes na tela.
        actions={
          documents.length > 0 ? (
            <AppStack direction="row" gap="sm">
              {checkPosition}
              {importNote}
            </AppStack>
          ) : undefined
        }
      />

      <KindCards documents={documents} selected={kind} onSelect={setKind} />

      {isPending ? (
        <DocumentListSkeleton />
      ) : shown.length > 0 ? (
        <DocumentList documents={shown} onOpen={openDocument.open} />
      ) : (
        <AppCard padding="md">
          <AppEmptyState
            size="section"
            title={
              kind === null
                ? 'Nenhum arquivo guardado ainda'
                : `Nenhum arquivo do tipo ${DOCUMENT_KIND[kind].one.toLowerCase()}`
            }
            description={
              kind === null
                ? 'Toda nota de corretagem e todo extrato enviados em Trades ficam guardados aqui, como chegaram — mesmo quando a leitura falha.'
                : `Eles chegam por ${DOCUMENT_KIND[kind].source}.`
            }
            action={
              kind === 'position_statement' ? checkPosition : kind === 'brokerage_note' ? importNote : (
                <AppStack direction="row" gap="sm">
                  {checkPosition}
                  {importNote}
                </AppStack>
              )
            }
          />
        </AppCard>
      )}

      <AppSnackbar
        open={error !== null}
        message={error ?? ''}
        tone="danger"
        onClose={() => setError(null)}
      />
    </AppStack>
  )
}
