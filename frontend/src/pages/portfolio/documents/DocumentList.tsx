import type { DocumentNote, PortfolioDocument } from '@/api/portfolioDocument'
import {
  AppButton,
  AppCard,
  AppChip,
  AppDivider,
  AppListRow,
  AppStack,
  AppStackItem,
  AppText,
  SectionLabel,
} from '@/components/ui'
import { formatDate } from '@/lib/utils/format'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import { Fragment, useMemo } from 'react'
import { fileSize, uploadedDate, uploadedMonth, uploadedTime } from './format'
import { DOCUMENT_KIND } from './kinds'

interface DocumentListProps {
  /** Do envio mais recente ao mais antigo, como a API os devolve. */
  documents: readonly PortfolioDocument[]
  onOpen: (documentId: number) => void
}

const noteLabel = (note: DocumentNote) =>
  [
    note.note_number ? `Nota ${note.note_number}` : 'Nota',
    note.broker_name,
    `pregão ${formatDate(note.trade_date)}`,
  ].join(' · ')

/* Os arquivos guardados, como uma lista de arquivos e não como uma tabela:
 * o nome é o que se procura, e o resto — tipo, tamanho, quando chegou, o que
 * foi confirmado a partir dele — fica embaixo, em letra menor.
 *
 * Agrupados pelo mês do envio, que é como se lembra de um arquivo ("a nota
 * que mandei em setembro"). */
export default function DocumentList({ documents, onOpen }: DocumentListProps) {
  const months = useMemo(() => {
    const groups = new Map<string, PortfolioDocument[]>()
    for (const document of documents) {
      const month = uploadedMonth(document.uploaded_at)
      groups.set(month, [...(groups.get(month) ?? []), document])
    }
    return [...groups.entries()]
  }, [documents])

  return (
    <AppCard padding="md">
      <AppStack gap="lg">
        {months.map(([month, inMonth]) => (
          <AppStack key={month} gap="xs">
            <SectionLabel>{month}</SectionLabel>
            {inMonth.map((document, index) => (
              <Fragment key={document.id}>
                {index > 0 && <AppDivider />}
                <AppListRow>
                  <AppStack direction="row" gap="md" align="center" grow>
                    <AppText variant="bodySmall" tone="secondary" inline>
                      <PictureAsPdfOutlinedIcon />
                    </AppText>
                    <AppStackItem>
                      <AppStack gap="xs">
                        <AppText variant="body" weight="strong">
                          {document.filename}
                        </AppText>
                        <AppText variant="caption" tone="secondary">
                          {[
                            DOCUMENT_KIND[document.kind].one,
                            fileSize(document.size_bytes),
                            `enviado em ${uploadedDate(document.uploaded_at)} às ${uploadedTime(document.uploaded_at)}`,
                          ].join(' · ')}
                        </AppText>
                        {document.notes.length > 0 && (
                          <AppStack direction="row" gap="xs" wrap>
                            {document.notes.map((note) => (
                              <AppChip key={note.id} label={noteLabel(note)} emphasis="outline" />
                            ))}
                          </AppStack>
                        )}
                      </AppStack>
                    </AppStackItem>
                    <AppButton
                      emphasis="ghost"
                      size="sm"
                      icon={<OpenInNewIcon fontSize="small" />}
                      onClick={() => onOpen(document.id)}
                    >
                      Abrir
                    </AppButton>
                  </AppStack>
                </AppListRow>
              </Fragment>
            ))}
          </AppStack>
        ))}
      </AppStack>
    </AppCard>
  )
}
