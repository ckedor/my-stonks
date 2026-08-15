/* Tabela paginada com ações por linha.
 *
 * Morava em `components/admin/`, o que sugeria uma tela específica, mas o
 * componente não sabe nada de domínio: recebe colunas, linhas e callbacks.
 * Isso o torna design system pela regra da camada 1, e é o que permite às
 * cinco telas de admin não importarem mais MUI.
 *
 * Convive com o `AppTable`, que resolve outro problema — dados financeiros
 * com ordenação, moeda e linha de total. Unificar os dois é uma decisão
 * para quando as telas de portfolio migrarem. */

import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import {
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Tooltip,
} from '@mui/material'
import { useState } from 'react'
import AppStack from './AppStack'

export interface ColumnConfig {
  field: string
  label: string
  align?: 'left' | 'right' | 'center'
  format?: (value: any, row: any) => string | React.ReactNode
}

export interface AppCrudTableProps {
  data: any[]
  columns: ColumnConfig[]
  onEdit: (item: any) => void
  onDelete?: (item: any) => void
  idField?: string
  rowsPerPageOptions?: number[]
}

export default function AppCrudTable({
  data,
  columns,
  onEdit,
  onDelete,
  idField = 'id',
  rowsPerPageOptions = [10, 20, 50],
}: AppCrudTableProps) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const paginatedData = data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  return (
    <Paper>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.field} align={col.align || 'left'} sx={{ fontWeight: 600 }}>
                  {col.label}
                </TableCell>
              ))}
              <TableCell align="center" sx={{ fontWeight: 600 }}>
                Ações
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row) => (
              <TableRow key={row[idField]} hover>
                {columns.map((col) => (
                  <TableCell key={col.field} align={col.align || 'left'}>
                    {col.format ? col.format(row[col.field], row) : row[col.field]}
                  </TableCell>
                ))}
                <TableCell align="center">
                  <AppStack direction="row" gap="xs" justify="center">
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => onEdit(row)} color="primary">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {onDelete && (
                      <Tooltip title="Excluir">
                        <IconButton size="small" onClick={() => onDelete(row)} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </AppStack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={rowsPerPageOptions}
        component="div"
        count={data.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="Linhas por página:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
      />
    </Paper>
  )
}
