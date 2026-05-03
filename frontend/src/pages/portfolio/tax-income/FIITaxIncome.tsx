
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

interface TaxReportItem {
  month: string // format YYYY-MM
  gross_sales: number
  realized_profit: number
  accumulated_loss: number
  tax_due: number
}

interface Props {
  portfolioId: number
  fiscalYear: number
}

export default function FIITaxIncome({ portfolioId, fiscalYear }: Props) {
  const [data, setData] = useState<TaxReportItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const res = await api.get(
          INCOME_TAX_ROUTES.fiiOperation(portfolioId),
          {
            params: { fiscal_year: fiscalYear },
          }
        )
        setData(res.data)
      } catch (err) {
        console.error('Erro ao buscar dados de IR para FIIs', err)
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
        Apuração de Ganhos - FIIs ({fiscalYear})
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mês</TableCell>
              <TableCell align="right">Total Vendas</TableCell>
              <TableCell align="right">Lucro Realizado</TableCell>
              <TableCell align="right">Prejuízo Acumulado</TableCell>
              <TableCell align="right">Alíquota</TableCell>
              <TableCell align="right">IR Devido</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.month}>
                <TableCell>{dayjs(item.month).format('MMM/YYYY')}</TableCell>
                <TableCell align="right">{formatValue(item.gross_sales)}</TableCell>
                <TableCell align="right" sx={{ color: profitColor(item.realized_profit) }}>
                  {formatValue(item.realized_profit)}
                </TableCell>
                <TableCell align="right">{formatValue(item.accumulated_loss)}</TableCell>
                <TableCell align="right">
                  {item.tax_due > 0
                    ? ((item.tax_due / item.realized_profit) * 100).toFixed(0) + '%'
                    : '-'}
                </TableCell>
                <TableCell align="right">{formatValue(item.tax_due)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </AppCard>
  )
}
