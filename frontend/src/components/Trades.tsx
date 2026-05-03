import { TRANSACTION_ROUTES } from '@/constants/routes'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { Trade } from '@/types'
import {
    Box,
    Button,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import TradeForm from './TradeForm'

interface TradesProps {
  assetId?: number
  assetTypes?: number[]
  currencyId?: number
}

export default function Trades({ assetId, assetTypes, currencyId }: TradesProps) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<Trade | undefined>()
  const { selectedPortfolio } = usePortfolioStore()
  const { format: formatCurrency } = useCurrency()

  const fetchTrades = async () => {
    if (!selectedPortfolio) return
    setLoading(true)

    const params: Record<string, any> = {}

    if (assetTypes && assetTypes.length > 0) {
      params.asset_type_ids = assetTypes
    } else if (assetId) {
      params.asset_id = assetId
    }

    if (currencyId) {
      params.currency_id = currencyId
    }

    const { data } = await api.get(TRANSACTION_ROUTES.list, { params: { portfolio_id: selectedPortfolio.id, ...params } })

    setTrades(data.sort((a: Trade, b: Trade) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    setLoading(false)
  }

  useEffect(() => {
    fetchTrades()
  }, [selectedPortfolio, assetId, currencyId, JSON.stringify(assetTypes)])

  const handleNew = () => {
    setSelectedTrade(undefined)
    setDrawerOpen(true)
  }

  const handleEdit = (trade: Trade) => {
    setSelectedTrade(trade)
    setDrawerOpen(true)
  }

  return (
    <Box sx={{ p: 2, height: 500, display: 'flex', flexDirection: 'column' }}>
      <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Compras / Vendas</Typography>
        <Button variant="contained" onClick={handleNew}>
          Nova Operação
        </Button>
      </Box>

      {loading ? (
        <Box flex={1} display="flex" alignItems="center" justifyContent="center">
          <CircularProgress size={60} />
        </Box>
      ) : (
        <TableContainer sx={{ overflowY: 'auto', flex: 1 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Data</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Ativo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Corretora</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Qtd
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Qtd Acum.
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Preço
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Valor Total
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Posição na Data
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Preço Médio
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Lucro Realizado
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  %Lucro
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trades.map((trade, idx) => (
                <TableRow
                  key={idx}
                  onClick={() => handleEdit(trade)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                >
                  <TableCell>{dayjs(trade.date).format('DD/MM/YYYY')}</TableCell>
                  <TableCell>{trade.ticker}</TableCell>
                  <TableCell>{trade.broker}</TableCell>
                  <TableCell
                    sx={{
                      textTransform: 'capitalize',
                      color: trade.type === 'Compra' ? 'primary.main' : 'success.main',
                      fontWeight: 'bold',
                    }}
                  >
                    {trade.type}
                  </TableCell>
                  <TableCell align="right">
                    {trade.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
                  </TableCell>
                  <TableCell align="right">
                    {trade.acc_quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(trade.price)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(trade.value)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(trade.position)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(trade.average_price)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        trade.realized_profit > 0
                          ? 'success.main'
                          : trade.realized_profit < 0
                            ? 'error.main'
                            : 'text.secondary',
                      fontWeight: 'bold',
                    }}
                  >
                    {trade.type === 'Compra'
                      ? '-'
                      : formatCurrency(trade.realized_profit)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        trade.profit_pct > 0
                          ? 'success.main'
                          : trade.profit_pct < 0
                            ? 'error.main'
                            : 'text.secondary',
                      fontWeight: 'bold',
                    }}
                  >
                    {trade.type === 'Compra'
                      ? '-'
                      : trade.profit_pct.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) +
                        ' %'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TradeForm
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={fetchTrades}
        trade={selectedTrade}
        assetId={assetId}
      />
    </Box>
  )
}
