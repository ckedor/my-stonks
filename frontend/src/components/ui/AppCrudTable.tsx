/* Tabela paginada com ações por linha — o par do `AppCrudForm` no CRUD do
 * admin, onde o formulário é a tabela virada de lado.
 *
 * Desenha com o `AppSimpleTable`, e o que mora aqui é só a tradução: a
 * coluna por `field` + `format` que o `AppCrudForm` também fala, e a coluna
 * de ações no fim. Antes ela tinha superfície, cabeçalho e alinhamento
 * próprios, e as quatro telas de cadastro não pareciam do mesmo app que o
 * resto. */

import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AppIconButton from './AppIconButton'
import AppSimpleTable, { type AppSimpleTableColumn } from './AppSimpleTable'
import AppStack from './AppStack'

const PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = [10, 20, 50]

export interface ColumnConfig {
  field: string
  label: string
  /** Número à direita, o resto à esquerda — a regra de toda tabela do app. */
  align?: 'left' | 'right'
  format?: (value: any, row: any) => string | React.ReactNode
}

export interface AppCrudTableProps {
  data: any[]
  columns: ColumnConfig[]
  onEdit: (item: any) => void
  onDelete?: (item: any) => void
  idField?: string
}

export default function AppCrudTable({
  data,
  columns,
  onEdit,
  onDelete,
  idField = 'id',
}: AppCrudTableProps) {
  const tableColumns: AppSimpleTableColumn<any>[] = [
    ...columns.map((column) => ({
      label: column.label,
      align: column.align,
      render: (row: any) =>
        column.format ? column.format(row[column.field], row) : row[column.field],
    })),
    {
      label: 'Ações',
      align: 'right',
      render: (row) => (
        <AppStack direction="row" gap="xs" justify="end">
          <AppIconButton label="Editar" tooltip size="sm" tone="primary" onClick={() => onEdit(row)}>
            <EditIcon fontSize="small" />
          </AppIconButton>
          {onDelete && (
            <AppIconButton
              label="Excluir"
              tooltip
              size="sm"
              tone="danger"
              onClick={() => onDelete(row)}
            >
              <DeleteIcon fontSize="small" />
            </AppIconButton>
          )}
        </AppStack>
      ),
    },
  ]

  return (
    <AppSimpleTable
      rows={data}
      columns={tableColumns}
      getRowKey={(row) => row[idField]}
      surface="outlined"
      pageSize={PAGE_SIZE}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
    />
  )
}
