import { useMemo } from 'react'
import { AppAlert, AppPageHeader, AppStack } from '@/components/ui'
import { formatBRL } from '@/lib/utils/format'
import { useUsdBrlHistory } from '@/queries/market'
import { closesToCandleData } from '../series/candles'
import MarketSeriesSkeleton from '../series/MarketSeriesSkeleton'
import SeriesHistoryCard from '../series/SeriesHistoryCard'

/* O primeiro dia do real. Antes dele a tabela guarda cruzeiros e cruzados sem
   reescala, e a linha começaria em milhares de "reais" por dólar. */
const REAL_CURRENCY_START = '1994-07-01'

/** O dólar em reais, com o mesmo gráfico dos índices. O câmbio não é uma
 *  série de dados de mercado — tem tabela própria —, por isso a tela é sua. */
export default function MarketUsdBrlPage() {
  const { history, loading, failed } = useUsdBrlHistory()
  const candleData = useMemo(
    () =>
      closesToCandleData(
        history
          .filter((point) => point.date >= REAL_CURRENCY_START)
          .map((point) => ({ date: point.date, close: Number(point.usd_brl) })),
      ),
    [history],
  )

  if (loading) return <MarketSeriesSkeleton />

  const breadcrumbs = [
    { label: 'Mercado', href: '/market/assets' },
    { label: 'Visão geral', href: '/market/overview' },
    { label: 'Dólar' },
  ]
  return (
    <AppStack gap="lg">
      <AppPageHeader title="Dólar" breadcrumbs={breadcrumbs} />
      {failed ? (
        <AppAlert severity="error">Não foi possível carregar o histórico do câmbio.</AppAlert>
      ) : (
        <SeriesHistoryCard
          data={candleData}
          caption="USD/BRL · reais por dólar, desde o Plano Real"
          priceFormatter={formatBRL}
          persistKey="market-usd-brl"
        />
      )}
    </AppStack>
  )
}
