import type { DocumentKind, PortfolioDocument } from '@/api/portfolioDocument'
import { AppIconButton, AppSimpleTable, type AppSimpleTableColumn } from '@/components/ui'
import { formatDate } from '@/lib/utils/format'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'

const KIND_LABEL: Record<DocumentKind, string> = {
  brokerage_note: 'Nota de corretagem',
  position_statement: 'Extrato de posição',
}

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`

const describeNotes = (document: PortfolioDocument) =>
  document.notes.length === 0
    ? '—'
    : document.notes
        .map((note) =>
          [
            note.note_number ? `Nota ${note.note_number}` : 'Nota sem número',
            note.broker_name,
            formatDate(note.trade_date),
          ].join(' · ')
        )
        .join('; ')

interface DocumentsTableProps {
  documents: PortfolioDocument[]
  onOpen: (documentId: number) => void
}

/** O histórico de PDFs enviados à carteira, com o que foi confirmado a partir de cada um. */
export default function DocumentsTable({ documents, onOpen }: DocumentsTableProps) {
  const columns: AppSimpleTableColumn<PortfolioDocument>[] = [
    {
      label: 'Enviado em',
      sortValue: (document) => document.uploaded_at,
      render: (document) => formatDate(document.uploaded_at),
    },
    { label: 'Arquivo', width: 'clamped', render: (document) => document.filename },
    {
      label: 'Tipo',
      sortValue: (document) => document.kind,
      render: (document) => KIND_LABEL[document.kind],
    },
    {
      label: 'Notas confirmadas',
      hint: 'As notas de corretagem importadas a partir deste PDF.',
      render: describeNotes,
    },
    { label: 'Tamanho', align: 'right', render: (document) => formatSize(document.size_bytes) },
    {
      label: 'PDF',
      align: 'right',
      render: (document) => (
        <AppIconButton label="Abrir o PDF" size="sm" tooltip onClick={() => onOpen(document.id)}>
          <PictureAsPdfIcon fontSize="small" />
        </AppIconButton>
      ),
    },
  ]
  return (
    <AppSimpleTable
      rows={documents}
      columns={columns}
      getRowKey={(document) => document.id}
      surface="outlined"
      emptyMessage="Nenhum PDF enviado nesta carteira ainda."
    />
  )
}
