import type { ImportedBrokerageNote } from '@/api/brokerageNote'
import { AppIconButton, AppSimpleTable, type AppSimpleTableColumn } from '@/components/ui'
import { formatDate, formatMoney } from '@/lib/utils/format'
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf'

const columns: AppSimpleTableColumn<ImportedBrokerageNote>[] = [
  {
    label: 'Pregão',
    sortValue: (note) => note.trade_date,
    render: (note) => formatDate(note.trade_date),
  },
  { label: 'Nota', render: (note) => note.note_number ?? '—' },
  { label: 'Corretora', render: (note) => note.broker_name },
  {
    label: 'Valor das operações',
    align: 'right',
    render: (note) => formatMoney(note.operations_total, note.currency),
  },
  { label: 'Custos', align: 'right', render: (note) => formatMoney(note.fees, note.currency) },
  {
    label: 'IRRF',
    align: 'right',
    render: (note) => formatMoney(note.withheld_income_tax, note.currency),
  },
  {
    label: 'Líquido',
    align: 'right',
    render: (note) => formatMoney(note.net_amount, note.currency),
  },
  {
    label: 'Operações',
    align: 'right',
    hint: 'Transações da carteira criadas ou completadas por esta nota.',
    render: (note) => String(note.transaction_count),
  },
  { label: 'Importada em', render: (note) => formatDate(note.imported_at) },
]

interface ImportedNotesTableProps {
  notes: ImportedBrokerageNote[]
  onOpenDocument: (documentId: number) => void
}

/** O histórico: cada nota importada, com quantas operações ela ligou e o PDF de onde saiu. */
export default function ImportedNotesTable({ notes, onOpenDocument }: ImportedNotesTableProps) {
  const withDocument: AppSimpleTableColumn<ImportedBrokerageNote>[] = [
    ...columns,
    {
      label: 'PDF',
      align: 'right',
      hint: 'O arquivo de onde a nota foi lida. Notas importadas antes de os PDFs serem guardados não têm.',
      render: (note) =>
        note.document_id === null ? (
          '—'
        ) : (
          <AppIconButton
            label="Abrir o PDF da nota"
            size="sm"
            tooltip
            onClick={() => onOpenDocument(note.document_id!)}
          >
            <PictureAsPdfIcon fontSize="small" />
          </AppIconButton>
        ),
    },
  ]
  return (
    <AppSimpleTable
      rows={notes}
      columns={withDocument}
      getRowKey={(note) => note.id}
      surface="outlined"
      emptyMessage="Nenhuma nota importada nesta carteira ainda."
    />
  )
}
