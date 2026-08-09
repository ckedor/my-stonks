import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
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

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100]

export interface Column<Row> {
  label: string
  align?: 'left' | 'right' | 'center'
  render: (row: Row) => React.ReactNode
}

export const formatDate = (value: string) =>
  new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR')

export const formatNumber = (value: number | string | null, digits = 2) => {
  if (value === null || value === undefined || value === '') return '—'
  const parsed = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('pt-BR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : '—'
}

/** Read-only paginated table sorted and filterable by its date column.
 *
 * Every row set here is already fully loaded, so sorting and the day lookup
 * run in memory instead of costing another round trip. */
export default function DataTable<Row>({
  rows,
  columns,
  emptyMessage,
  getDate,
}: {
  rows: Row[]
  columns: Column<Row>[]
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
    return <Alert severity="info">{emptyMessage}</Alert>
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
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
          <Button size="small" onClick={() => setDayFilter('')}>
            Limpar
          </Button>
        )}
      </Stack>

      {visibleRows.length === 0 ? (
        <Alert severity="info">Nenhum registro em {formatDate(dayFilter)}.</Alert>
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
    </Box>
  )
}
