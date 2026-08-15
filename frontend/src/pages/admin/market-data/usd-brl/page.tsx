import { fetchUsdBrlHistory, type UsdBrlHistoryPoint } from '@/api/market'
import {
    AppAlert,
    AppDataTable,
    AppStack,
    AppText,
    LoadingSpinner,
    PageTitle,
} from '@/components/ui'
import { formatDate, formatNumber } from '@/lib/utils/format'
import { useEffect, useState } from 'react'

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
    <AppStack gap="lg">
      <PageTitle>Dólar</PageTitle>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <AppAlert severity="error">{error}</AppAlert>
      ) : (
        <AppStack gap="md">
          <AppText variant="bodySmall" tone="secondary">
            {rows.length} observações — as duas direções são gravadas na ingestão.
          </AppText>
          <AppDataTable
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
        </AppStack>
      )}
    </AppStack>
  )
}
