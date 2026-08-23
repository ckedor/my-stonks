import { syncBenchmarks } from '@/actions/portfolio'
import { fetchAssetQuoteHistory } from '@/api/market'
import PortfolioReturnsChart, {
  type ReturnsChartExternalSeries,
} from '@/components/PortfolioReturnsChart'
import { AppAlert, AppCard, AppStack, LoadingSpinner, SectionTitle } from '@/components/ui'
import { getDateFromRange } from '@/lib/utils/date'
import { useCurrencyStore } from '@/stores/currency'
import { memo, useEffect, useMemo, useState } from 'react'

interface ExternalBenchmark {
  assetId: number | null
  key: string
  label: string
  color?: string
}

interface Props {
  title: string
  benchmarks: string[]
  persistKey: string
  external?: ExternalBenchmark
}

/** The common market-page comparison card. An asset can stand in for a class
 *  benchmark when there is no registered broad series, as BTC does for crypto. */
export default memo(function MarketBenchmarkCard({
  title,
  benchmarks,
  persistKey,
  external,
}: Props) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)
  const [externalSeries, setExternalSeries] = useState<ReturnsChartExternalSeries[]>([])
  const currency = useCurrencyStore((state) => state.currency)
  const externalAssetId = external?.assetId
  const externalColor = external?.color
  const externalKey = external?.key
  const externalLabel = external?.label
  const hasExternal = external != null

  useEffect(() => {
    let active = true
    setReady(false)
    setError(false)

    const externalRequest = hasExternal
      ? externalAssetId == null
        ? Promise.reject(new Error(`Ativo ${externalKey} não cadastrado`))
        : fetchAssetQuoteHistory(
            externalAssetId,
            getDateFromRange('5y').format('YYYY-MM-DD'),
            currency,
          ).then((history) => [{
            key: externalKey!,
            label: externalLabel!,
            color: externalColor,
            data: pricesToReturns(history.quotes),
          }])
      : Promise.resolve([])

    void Promise.all([syncBenchmarks(true), externalRequest])
      .then(([, series]) => {
        if (!active) return
        setExternalSeries(series)
        setReady(true)
      })
      .catch(() => {
        if (active) setError(true)
      })

    return () => {
      active = false
    }
  }, [currency, externalAssetId, externalColor, externalKey, externalLabel, hasExternal])

  const selectedExternalSeries = useMemo(
    () => externalSeries.map((series) => series.key),
    [externalSeries],
  )

  return (
    <AppCard>
      <AppStack gap="md">
        <SectionTitle>{title}</SectionTitle>
        {ready ? (
          <PortfolioReturnsChart
            size={420}
            selectedBenchmarks={benchmarks}
            externalSeries={externalSeries}
            selectedExternalSeries={selectedExternalSeries}
            defaultRange="5y"
            persistKey={persistKey}
          />
        ) : error ? (
          <AppAlert severity="error">Não foi possível carregar {title}.</AppAlert>
        ) : (
          <LoadingSpinner />
        )}
      </AppStack>
    </AppCard>
  )
})

function pricesToReturns(
  quotes: { date: string; close: number; adjusted_close: number | null }[],
) {
  const sorted = [...quotes]
    .filter((quote) => (quote.adjusted_close ?? quote.close) > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
  const base = sorted[0] ? (sorted[0].adjusted_close ?? sorted[0].close) : null
  if (base == null || base <= 0) return []

  return sorted.map((quote) => ({
    date: quote.date.slice(0, 10),
    value: (quote.adjusted_close ?? quote.close) / base - 1,
  }))
}
