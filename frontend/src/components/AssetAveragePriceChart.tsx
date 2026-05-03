import { POSITION_ROUTES, TRANSACTION_ROUTES } from '@/constants/routes'
import { useCurrency } from '@/hooks/useCurrency'
import api from '@/lib/api'
import { usePortfolioStore } from '@/stores/portfolio'
import { Box, CircularProgress, Typography, useTheme } from '@mui/material'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import dayjs, { Dayjs } from 'dayjs'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'

dayjs.extend(isSameOrBefore)

import { JSX, useEffect, useState } from 'react'
import {
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Scatter,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

interface PositionHistoryEntry {
  date: string
  price: number
  quantity: number
  average_price: number
}

interface TransactionEntry {
  date: string
  price: number
  quantity: number
}

interface Props {
  size: number
  assetId: number
}

const LABELS = {
  quantity: 'Quantidade',
  price: 'Cotação',
  average_price: 'Preço Médio',
}

export default function AssetAveragePriceChart({ size, assetId }: Props) {
  const selectedPortfolio = usePortfolioStore(s => s.selectedPortfolio)
  const { currency, format: fmtCurrency } = useCurrency()
  const [history, setHistory] = useState<PositionHistoryEntry[]>([])
  const [transactions, setTransactions] = useState<TransactionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState<Dayjs | null>(null)
  const [endDate, setEndDate] = useState<Dayjs | null>(null)

  const theme = useTheme();
  const COLORS = {
    quantity: theme.palette.chart.colors[0],
    price: theme.palette.primary.main,
    average_price: theme.palette.error.main,
  }

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedPortfolio?.id || !assetId) return

      setLoading(true)
      try {
        const [historyRes, transactionsRes] = await Promise.all([
          api.get(POSITION_ROUTES.byPortfolio(selectedPortfolio.id), {
            params: { most_recent: false, asset_id: assetId, currency },
          }),
          api.get(TRANSACTION_ROUTES.list, {
            params: { portfolio_id: selectedPortfolio.id, asset_id: assetId },
          }),
        ])

        const historyData = historyRes.data.map((h: any) => ({
          date: h.date,
          price: h.price,
          average_price: h.average_price,
          quantity: h.quantity,
        }))

        const txData = transactionsRes.data.map((t: any) => ({
          date: t.date,
          price: t.price,
          quantity: t.quantity,
        }))

        setHistory(historyData)
        setTransactions(txData)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedPortfolio?.id, assetId, currency])

  const mergedData = history.map((h) => {
    const transaction = transactions.find((t) => t.date === h.date)
    return {
      ...h,
      transaction_value: transaction?.price ?? null,
      transaction_quantity: transaction?.quantity ?? null,
    }
  })

  const filteredData = mergedData.filter((d) => {
    const date = dayjs(d.date)
    return (
      (!startDate || date.isSameOrAfter(startDate)) && (!endDate || date.isSameOrBefore(endDate))
    )
  })

  const renderTransactionShape = (props: any): JSX.Element => {
    const { cx, cy, payload } = props
    const qty = Math.abs(payload.transaction_quantity || 0)


    if (!payload.transaction_value || qty === 0) return <></>

    const minSize = 4
    const maxSize = 20
    const referenceQty = 10
    const normalized = Math.min(qty / referenceQty, 1)
    const scale = minSize + (maxSize - minSize) * normalized

    if (payload.transaction_quantity > 0) {
      return (
        <path
          d={`M${cx},${cy - scale} L${cx - scale},${cy + scale} L${cx + scale},${cy + scale} Z`}
          fill="green"
        />
      )
    }

    if (payload.transaction_quantity < 0) {
      return (
        <path
          d={`M${cx},${cy + scale} L${cx - scale},${cy - scale} L${cx + scale},${cy - scale} Z`}
          fill="red"
        />
      )
    }

    return <></>
  }

  return (
    <Box width="100%" height={size}>
      {loading ? (
        <Box height={size} display="flex" justifyContent="center" alignItems="center">
          <CircularProgress size={48} thickness={4} />
        </Box>
      ) : (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="h6">Preço Médio e Quantidade</Typography>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <Box display="flex" gap={2}>
                <DatePicker
                  label="De"
                  value={startDate}
                  onChange={(newValue) => setStartDate(newValue)}
                  slotProps={{ textField: { size: 'small' } }}
                />
                <DatePicker
                  label="Até"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue)}
                  slotProps={{ textField: { size: 'small' } }}
                />
              </Box>
            </LocalizationProvider>
          </Box>

          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.chart.grid} />
              <XAxis 
                dataKey="date" 
                tickFormatter={(d) => dayjs(d).format('MM/YY')} 
                stroke={theme.palette.text.primary} />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                domain={['auto', 'auto']} 
                stroke={theme.palette.text.primary} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke={theme.palette.text.primary}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null

                  const data = payload[0].payload
                  const preco = data.transaction_value
                  const quantidade = data.transaction_quantity
                  const total = quantidade && preco ? quantidade * preco : null

                  return (
                    <Box p={1} border="1px solid #ccc" borderRadius={2} bgcolor="#fff">
                      <Typography fontSize={12} mb={0.5}>
                        {dayjs(label).format('DD/MM/YYYY')}
                      </Typography>
                      <Typography fontSize={13} style={{ color: COLORS.quantity }}>
                        {LABELS.quantity}: {data.quantity}
                      </Typography>
                      <Typography fontSize={13} style={{ color: COLORS.price }}>
                        {LABELS.price}: {fmtCurrency(data.price)}
                      </Typography>
                      <Typography fontSize={13} style={{ color: COLORS.average_price }}>
                        {LABELS.average_price}: {fmtCurrency(data.average_price)}
                      </Typography>
                      {quantidade !== null && quantidade !== undefined && (
                        <>
                          <Typography fontSize={13} color={quantidade > 0 ? 'green' : 'red'}>
                            {quantidade > 0 ? 'Compra' : 'Venda'} a {fmtCurrency(preco)}
                          </Typography>
                          <Typography fontSize={13} color={quantidade > 0 ? 'green' : 'red'}>
                            Total: {fmtCurrency(total || 0)}
                          </Typography>
                        </>
                      )}
                    </Box>
                  )
                }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="quantity"
                stroke={COLORS.quantity}
                dot={false}
                name={LABELS.quantity}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="price"
                stroke={COLORS.price}
                dot={false}
                name={LABELS.price}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="average_price"
                stroke={COLORS.average_price}
                strokeDasharray="4 4"
                dot={false}
                name={LABELS.average_price}
              />
              <Scatter
                yAxisId="left"
                data={filteredData}
                dataKey="transaction_value"
                shape={renderTransactionShape}
                name="Transações"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </>
      )}
    </Box>
  )
}
