import { fetchUsdBrlHistory, type UsdBrlHistoryPoint } from '@/api/market'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Alert, Box, Stack, Typography } from '@mui/material'
import { useEffect, useState } from 'react'

import DataTable from '../DataTable'
import { formatDate, formatNumber } from '../format'

export default function AdminMarketDataUsdBrlPage() {
  const [rows, setRows] = useState<UsdBrlHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchUsdBrlHistory()
      .then((data) => {
        if (active) {
          setRows(data)
          setError(null)
        }
      })
      .catch(() => active && setError('Erro ao carregar o histórico do dólar'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <Box>
      <Typography variant="h5" mb={3}>
        Dólar
      </Typography>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {rows.length} observações — as duas direções são gravadas na ingestão.
          </Typography>
          <DataTable
            rows={rows}
            emptyMessage="Nenhuma cotação de dólar importada."
            getDate={(row) => row.date}
            columns={[
              { label: 'Data', render: (row) => formatDate(row.date) },
              { label: 'USD/BRL', align: 'right', render: (row) => formatNumber(row.usd_brl, 4) },
              { label: 'BRL/USD', align: 'right', render: (row) => formatNumber(row.brl_usd, 6) },
              { label: 'Fonte', render: (row) => row.source },
            ]}
          />
        </Stack>
      )}
    </Box>
  )
}
