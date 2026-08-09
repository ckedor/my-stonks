import {
  fetchMarketDataSeriesHistory,
  fetchMarketDataSeriesOptions,
  type MarketDataSeriesHistoryPoint,
  type MarketDataSeriesOption,
} from '@/api/market'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Alert, Autocomplete, Box, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'

import DataTable, { formatDate, formatNumber } from '../DataTable'

export default function AdminMarketDataSeriesPage() {
  const [options, setOptions] = useState<MarketDataSeriesOption[]>([])
  const [selected, setSelected] = useState<MarketDataSeriesOption | null>(null)
  const [rows, setRows] = useState<MarketDataSeriesHistoryPoint[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchMarketDataSeriesOptions()
      .then((data) => {
        if (!active) return
        setOptions(data)
        setSelected(data[0] ?? null)
      })
      .catch(() => active && setError('Erro ao carregar as séries'))
      .finally(() => active && setLoadingOptions(false))
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selected) {
      setRows([])
      return
    }
    let active = true
    setLoadingHistory(true)
    fetchMarketDataSeriesHistory(selected.id)
      .then((data) => {
        if (active) {
          setRows(data)
          setError(null)
        }
      })
      .catch(() => active && setError('Erro ao carregar o histórico da série'))
      .finally(() => active && setLoadingHistory(false))
    return () => {
      active = false
    }
  }, [selected])

  return (
    <Box>
      <Typography variant="h5" mb={3}>
        Séries
      </Typography>

      {loadingOptions ? (
        <LoadingSpinner />
      ) : (
        <Stack spacing={2}>
          <Autocomplete
            options={options}
            value={selected}
            onChange={(_, value) => setSelected(value)}
            getOptionLabel={(option) => `${option.short_name} — ${option.id}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Série" />}
            sx={{ maxWidth: 420 }}
          />

          {error && <Alert severity="error">{error}</Alert>}

          {loadingHistory ? (
            <LoadingSpinner />
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                {rows.length} observações.
              </Typography>
              <DataTable
                rows={rows}
                emptyMessage="Nenhum histórico importado para esta série."
                getDate={(row) => row.date}
                columns={[
                  { label: 'Data', render: (row) => formatDate(row.date) },
                  {
                    label: 'Fechamento',
                    align: 'right',
                    render: (row) => formatNumber(row.close, 4),
                  },
                  { label: 'Abertura', align: 'right', render: (row) => formatNumber(row.open, 4) },
                  { label: 'Máxima', align: 'right', render: (row) => formatNumber(row.high, 4) },
                  { label: 'Mínima', align: 'right', render: (row) => formatNumber(row.low, 4) },
                  { label: 'Fonte', render: (row) => row.source ?? '—' },
                ]}
              />
            </>
          )}
        </Stack>
      )}
    </Box>
  )
}
