import {
  fetchMarketDataSeriesHistory,
  fetchMarketDataSeriesOptions,
  type MarketDataSeriesHistoryPoint,
  type MarketDataSeriesOption,
} from '@/api/market'
import {
    AppAlert,
    AppAutocomplete,
    AppDataTable,
    AppStack,
    AppText,
    LoadingSpinner,
    PageTitle,
} from '@/components/ui'
import { formatDate, formatNumber } from '@/lib/utils/format'
import { useEffect, useState } from 'react'

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
    <AppStack gap="lg">
      <PageTitle>Séries</PageTitle>

      {loadingOptions ? (
        <LoadingSpinner />
      ) : (
        <AppStack gap="md">
          <AppAutocomplete
            options={options}
            value={selected}
            onChange={setSelected}
            getOptionLabel={(option) => `${option.short_name} — ${option.id}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            label="Série"
            size="md"
          />

          {error && <AppAlert severity="error">{error}</AppAlert>}

          {loadingHistory ? (
            <LoadingSpinner />
          ) : (
            <>
              <AppText variant="bodySmall" tone="secondary">
                {rows.length} observações.
              </AppText>
              <AppDataTable
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
        </AppStack>
      )}
    </AppStack>
  )
}
