/* Tabela paginada, ordenável e filtrável por data.
 *
 * Morava em `pages/admin/market-data/`, mas não sabe nada de market data:
 * recebe linhas, colunas e uma função que diz a data de cada linha. Pela
 * regra da camada 1 é design system, e é o que tira o MUI das três telas
 * que a usam.
 *
 * Terceira tabela do design system, ao lado de `AppTable` (dados
 * financeiros com moeda e total) e `AppCrudTable` (ações por linha).
 * Unificá-las é decisão para quando o portfolio migrar e os casos de uso
 * estiverem todos à vista. */

import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import AppAlert from './AppAlert'
import AppButton from './AppButton'
import AppStack from './AppStack'
import { formatDate } from '@/lib/utils/format'

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]

export interface AppDataTableColumn<Row> {
  label: string
  align?: 'left' | 'right' | 'center'
  render: (row: Row) => React.ReactNode
}

/** Read-only paginated table sorted and filterable by its date column.
 *
 * Every row set here is already fully loaded, so sorting and the day lookup
 * run in memory instead of costing another round trip. */
export default function AppDataTable<Row>({
  rows,
  columns,
  emptyMessage,
  getDate,
}: {
  rows: Row[]
  columns: AppDataTableColumn<Row>[]
  emptyMessage: string
  /** ISO date the row belongs to, used for sorting and the day filter. */
  getDate: (row: Row) => string
}) {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0])
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [dayFilter, setDayFilter] = useState('')

  useEffect(() => {
    setPage(0)
  }, [rows, sortDirection, dayFilter])

  const visibleRows = useMemo(() => {
    const isoDate = (row: Row) => getDate(row).slice(0, 10)
    const filtered = dayFilter ? rows.filter((row) => isoDate(row) === dayFilter) : rows
    // ISO dates sort correctly as plain strings.
    return [...filtered].sort((a, b) =>
      sortDirection === 'asc'
        ? isoDate(a).localeCompare(isoDate(b))
        : isoDate(b).localeCompare(isoDate(a)),
    )
  }, [rows, dayFilter, sortDirection, getDate])

  const paginated = visibleRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  if (rows.length === 0) {
    return <AppAlert severity="info">{emptyMessage}</AppAlert>
  }

  return (
    <AppStack gap="md">
      <AppStack direction="row" gap="sm" align="center">
        <TextField
          type="date"
          size="small"
          label="Buscar data"
          value={dayFilter}
          onChange={(event) => setDayFilter(event.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 200 }}
        />
        {dayFilter && (
          <AppButton tone="ghost" size="sm" onClick={() => setDayFilter('')}>
            Limpar
          </AppButton>
        )}
      </AppStack>

      {visibleRows.length === 0 ? (
        <AppAlert severity="info">Nenhum registro em {formatDate(dayFilter)}.</AppAlert>
      ) : (
        <Paper>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {columns.map((column, index) => (
                    <TableCell
                      key={column.label}
                      align={column.align ?? 'left'}
                      sortDirection={index === 0 ? sortDirection : false}
                      sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      {index === 0 ? (
                        <TableSortLabel
                          active
                          direction={sortDirection}
                          onClick={() =>
                            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
                          }
                        >
                          {column.label}
                        </TableSortLabel>
                      ) : (
                        column.label
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.map((row, index) => (
                  <TableRow key={index} hover>
                    {columns.map((column) => (
                      <TableCell key={column.label} align={column.align ?? 'left'}>
                        {column.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
            component="div"
            count={visibleRows.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10))
              setPage(0)
            }}
            labelRowsPerPage="Linhas por página:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
          />
        </Paper>
      )}
    </AppStack>
  )
}
