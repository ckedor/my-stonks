import type { BrokerageNoteDraft } from '@/api/brokerageNote'
import {
  AppButton,
  AppCard,
  AppFileField,
  AppSnackbar,
  AppStack,
  AppTableSkeleton,
  AppText,
  SectionTitle,
} from '@/components/ui'
import { useAssets } from '@/queries/assets'
import { useBrokers, useExtractBrokerageNote } from '@/queries/brokerageNote'
import { EMPTY_LIST } from '@/queries/empty'
import { useBrokerageNotes, useSelectedPortfolioId, useTrades } from '@/queries/portfolio'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { useState } from 'react'
import ImportedNotesTable from './ImportedNotesTable'
import NoteImport, { type Notice } from './NoteImport'

/* Aba "Importar nota" de Trades.
 *
 * O PDF vai ao modelo, que devolve as notas; a aplicação confere os totais de
 * cada uma, rateia os custos e cruza as linhas com o que a carteira já tem.
 * Nada é gravado antes de confirmar, e cada nota se confirma sozinha: a tela é
 * o dry-run. Confirmar guarda a nota no histórico e liga a ela as operações.
 * Reimportar uma nota já lançada não duplica — o cruzamento propõe completar
 * ou substituir. */

function errorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: string } } })?.response
  return response?.data?.message ?? fallback
}

export default function BrokerageNoteImport() {
  const portfolioId = useSelectedPortfolioId()
  const { assets } = useAssets()
  const { brokers } = useBrokers()
  const { data: tradesData } = useTrades()
  const trades = tradesData ?? EMPTY_LIST
  const { data: importedData, isPending: importedLoading } = useBrokerageNotes()
  const imported = importedData ?? EMPTY_LIST

  const extraction = useExtractBrokerageNote()
  const [file, setFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<BrokerageNoteDraft | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  const handleExtract = () => {
    if (!file || portfolioId == null) return
    extraction.mutate(
      { portfolioId, file },
      {
        onSuccess: setDraft,
        onError: (error) =>
          setNotice({
            message: errorMessage(error, 'Não foi possível ler a nota'),
            tone: 'danger',
          }),
      }
    )
  }

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack gap="md">
          <AppText variant="bodySmall" tone="secondary">
            Nota de corretagem em PDF. O arquivo vai inteiro para o modelo, que transcreve as notas;
            a aplicação confere os totais de cada nota, rateia os custos entre as linhas e cruza
            cada operação com a carteira. Nada é gravado antes de confirmar cada nota.
          </AppText>
          <AppStack direction="row" gap="sm" align="center" wrap>
            <AppFileField
              label="Escolher PDF"
              accept="application/pdf"
              icon={<UploadFileIcon fontSize="small" />}
              onChange={setFile}
              disabled={extraction.isPending}
            />
            <AppButton
              onClick={handleExtract}
              disabled={!file || portfolioId == null}
              loading={extraction.isPending}
            >
              Ler notas
            </AppButton>
            {draft && (
              <AppButton emphasis="ghost" onClick={() => setDraft(null)}>
                Descartar leitura
              </AppButton>
            )}
          </AppStack>
        </AppStack>
      </AppCard>

      {draft && portfolioId != null && (
        <AppStack gap="md">
          <SectionTitle>
            {draft.notes.length === 1 ? 'Nota lida' : `${draft.notes.length} notas lidas`}
          </SectionTitle>
          {draft.notes.map((note) => (
            <NoteImport
              // A leitura nova troca as notas inteiras, com o estado de cada uma.
              key={`${draft.model}-${note.index}-${note.note_number}`}
              note={note}
              portfolioId={portfolioId}
              brokers={brokers}
              assets={assets}
              trades={trades}
              onNotice={setNotice}
            />
          ))}
        </AppStack>
      )}

      <AppStack gap="md">
        <SectionTitle>Notas importadas</SectionTitle>
        {importedLoading ? (
          <AppCard padding="md">
            <AppTableSkeleton columns={9} rows={4} />
          </AppCard>
        ) : (
          <ImportedNotesTable notes={imported} />
        )}
      </AppStack>

      <AppSnackbar
        open={notice !== null}
        message={notice?.message ?? ''}
        tone={notice?.tone ?? 'info'}
        onClose={() => setNotice(null)}
      />
    </AppStack>
  )
}
