import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { AppAlert, AppPageHeader, AppStack } from '@/components/ui'
import { formatNumber } from '@/lib/utils/format'
import { useMarketDataSeriesHistory, useMarketDataSeriesList } from '@/queries/market'
import { isDailyInterestRate, seriesHistoryToCandleData } from './candles'
import MarketSeriesSkeleton from './MarketSeriesSkeleton'
import SeriesHistoryCard from './SeriesHistoryCard'

const RATE = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** A tela de uma série de mercado: por enquanto, o gráfico dela.
 *
 *  Irmã da visão de mercado do ativo, com o mesmo gráfico, mas a série não é
 *  um ativo: não tem posição, logo, nem tipo. Um índice é mostrado em pontos,
 *  na moeda em que é calculado — um índice em dólar convertido para real
 *  seria outro índice. O CDI é mostrado ao ano. */
export default function MarketSeriesPage() {
  const seriesId = Number(useParams<{ id: string }>().id)
  const { series, loading: listLoading, failed: listFailed } = useMarketDataSeriesList()
  const { history, loading, failed } = useMarketDataSeriesHistory(seriesId)
  const current = series.find((item) => item.id === seriesId)
  const candleData = useMemo(
    () => (current ? seriesHistoryToCandleData(current, history) : []),
    [current, history],
  )

  if (listLoading || loading) return <MarketSeriesSkeleton />

  const breadcrumbs = [
    { label: 'Mercado', href: '/market/assets' },
    { label: 'Visão geral', href: '/market/overview' },
    { label: current?.short_name ?? 'Série' },
  ]

  if (listFailed || failed || !current) {
    return (
      <AppStack gap="lg">
        <AppPageHeader title="Série de mercado" breadcrumbs={breadcrumbs} />
        <AppAlert severity="error">
          {current || listFailed
            ? 'Não foi possível carregar o histórico da série.'
            : 'Série não encontrada.'}
        </AppAlert>
      </AppStack>
    )
  }

  const rate = isDailyInterestRate(current)
  const currency = current.currency?.code
  const caption = rate
    ? `${current.name} · taxa ao ano equivalente, nos dias com pregão`
    : currency
      ? `${current.name} · em pontos, calculado em ${currency}`
      : current.name
  return (
    <AppStack gap="lg">
      <AppPageHeader title={current.short_name} breadcrumbs={breadcrumbs} />
      <SeriesHistoryCard
        data={candleData}
        caption={caption}
        priceFormatter={rate ? (value) => RATE.format(value) : (value) => formatNumber(value)}
        persistKey="market-series"
      />
    </AppStack>
  )
}
