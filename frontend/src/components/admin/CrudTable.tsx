import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import {
    Box,
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

export interface ColumnConfig {
  field: string
  label: string
  align?: 'left' | 'right' | 'center'
  format?: (value: any, row: any) => string | React.ReactNode
}

interface CrudTableProps {
  data: any[]
  columns: ColumnConfig[]
  onEdit: (item: any) => void
  onDelete?: (item: any) => void
  idField?: string
  rowsPerPageOptions?: number[]
}

export default function CrudTable({
  data,
  columns,
  onEdit,
  onDelete,
  idField = 'id',
  rowsPerPageOptions = [10, 20, 50],
}: CrudTableProps) {
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
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
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
                  </Box>
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
