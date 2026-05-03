
import AppCard from '@/components/ui/AppCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { INCOME_TAX_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography
} from '@mui/material'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'

interface DarfEntry {
  label: string
  gross_sales: number
  base: number
  tax: number
  darf: number
}

interface DarfReportItem {
  month: string // format YYYY-MM
  entries: DarfEntry[]
}

interface Props {
  portfolioId: number
  fiscalYear: number
}

export default function DarfSummaryTable({ portfolioId, fiscalYear }: Props) {
  const [data, setData] = useState<DarfReportItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const res = await api.get(INCOME_TAX_ROUTES.darf(portfolioId), {
          params: { fiscal_year: fiscalYear },
        })
        setData(res.data)
      } catch (err) {
        console.error('Erro ao buscar dados do DARF', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [portfolioId, fiscalYear])

  if (loading) return <LoadingSpinner />

  const formatValue = (value: number) =>
    value === 0
      ? '-'
      : value.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })

  const profitColor = (value: number) => {
    if (value > 0) return '#2e7d32'
    if (value < 0) return '#c62828'
    return 'inherit'
  }

  return (
    <AppCard sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Meu DARF ({fiscalYear})
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mês/Ano</TableCell>
              <TableCell>Ativos</TableCell>
              <TableCell align="right">Total Vendas</TableCell>
              <TableCell align="right">Lucro Realizado</TableCell>
              <TableCell align="right">Alíquota</TableCell>
              <TableCell align="right">DARF</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((item, monthIndex) =>
              item.entries.map((entry, i) => (
                <TableRow
                  key={`${item.month}-${entry.label}`}
                  sx={{
                    backgroundColor: monthIndex % 2 === 0 ? 'background.paper' : 'action.hover',
                  }}
                >
                  <TableCell>{i === 0 ? dayjs(item.month).format('MMM/YYYY') : ''}</TableCell>
                  <TableCell>{entry.label}</TableCell>
                  <TableCell align="right">{formatValue(entry.gross_sales)}</TableCell>
                  <TableCell align="right" sx={{ color: profitColor(entry.base) }}>
                    {formatValue(entry.base)}
                  </TableCell>
                  <TableCell align="right">
                    {entry.darf > 0 ? ((entry.darf / entry.base) * 100).toFixed(0) + '%' : '-'}
                  </TableCell>
                  <TableCell align="right">
                    {entry.darf > 0 ? formatValue(entry.darf) : 'Isento'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </AppCard>
  )
}
