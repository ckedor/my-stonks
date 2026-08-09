import { fetchCurrencies, fetchPersistedQuotes, type PersistedQuote } from '@/api/market'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ASSET_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { Alert, Autocomplete, Box, Stack, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'

import DataTable, { formatDate, formatNumber } from '../DataTable'

const MAX_ASSET_OPTIONS_RENDERED = 100

interface AssetOption {
  id: number
  ticker: string | null
  name: string
}

export default function AdminMarketDataQuotesPage() {
  const [assets, setAssets] = useState<AssetOption[]>([])
  const [selected, setSelected] = useState<AssetOption | null>(null)
  const [rows, setRows] = useState<PersistedQuote[]>([])
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [loadingQuotes, setLoadingQuotes] = useState(false)
  const [currencyCodes, setCurrencyCodes] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([api.get<AssetOption[]>(ASSET_ROUTES.list), fetchCurrencies()])
      .then(([assetResponse, currencies]) => {
        if (!active) return
        setAssets(assetResponse.data)
        // Quotes carry a currency id; the table shows the code instead.
        setCurrencyCodes(
          Object.fromEntries(currencies.map((currency) => [currency.id, currency.code])),
        )
      })
      .catch(() => active && setError('Erro ao carregar os ativos'))
      .finally(() => active && setLoadingAssets(false))
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
    setLoadingQuotes(true)
    fetchPersistedQuotes(selected.id)
      .then((data) => {
        if (!active) return
        // An asset with no persisted history simply comes back empty.
        setRows(data[0]?.quotes ?? [])
        setError(null)
      })
      .catch(() => active && setError('Erro ao carregar as cotações'))
      .finally(() => active && setLoadingQuotes(false))
    return () => {
      active = false
    }
  }, [selected])

  const assetLabel = useCallback(
    (asset: AssetOption) => (asset.ticker ? `${asset.ticker} — ${asset.name}` : asset.name),
    [],
  )

  // 11k+ assets reach this selector, so cap what the dropdown renders per keystroke.
  const filterOptions = useMemo(
    () => (list: AssetOption[], state: { inputValue: string }) => {
      const query = state.inputValue.trim().toLowerCase()
      const matches = query
        ? list.filter((asset) => assetLabel(asset).toLowerCase().includes(query))
        : list
      return matches.slice(0, MAX_ASSET_OPTIONS_RENDERED)
    },
    [assetLabel],
  )

  return (
    <Box>
      <Typography variant="h5" mb={3}>
        Cotações de ativos
      </Typography>

      {loadingAssets ? (
        <LoadingSpinner />
      ) : (
        <Stack spacing={2}>
          <Autocomplete
            options={assets}
            value={selected}
            onChange={(_, value) => setSelected(value)}
            getOptionLabel={assetLabel}
            filterOptions={filterOptions}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label="Ativo" />}
            sx={{ maxWidth: 520 }}
          />

          {error && <Alert severity="error">{error}</Alert>}

          {!selected ? (
            <Alert severity="info">Selecione um ativo para ver as cotações persistidas.</Alert>
          ) : loadingQuotes ? (
            <LoadingSpinner />
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                {rows.length} cotações.
              </Typography>
              <DataTable
                rows={rows}
                emptyMessage="Nenhuma cotação persistida para este ativo."
                getDate={(row) => row.date}
                columns={[
                  { label: 'Data', render: (row) => formatDate(row.date) },
                  {
                    label: 'Moeda',
                    render: (row) =>
                      row.currency_id === null
                        ? '—'
                        : (currencyCodes[row.currency_id] ?? `#${row.currency_id}`),
                  },
                  { label: 'Fechamento', align: 'right', render: (row) => formatNumber(row.close) },
                  { label: 'Abertura', align: 'right', render: (row) => formatNumber(row.open) },
                  { label: 'Máxima', align: 'right', render: (row) => formatNumber(row.high) },
                  { label: 'Mínima', align: 'right', render: (row) => formatNumber(row.low) },
                  {
                    label: 'Fech. ajustado',
                    align: 'right',
                    render: (row) => formatNumber(row.adjusted_close),
                  },
                  { label: 'Volume', align: 'right', render: (row) => formatNumber(row.volume, 0) },
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
