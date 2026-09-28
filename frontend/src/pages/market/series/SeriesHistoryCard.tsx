import CandleChart, { type CandleDataPoint } from '@/components/charts/CandleChart'
import { AppCard, AppStack, AppText, SectionTitle } from '@/components/ui'
import { SERIES_CHART_HEIGHT } from './MarketSeriesSkeleton'

interface Props {
  data: CandleDataPoint[]
  /** O que a linha é: nome completo, unidade, moeda. */
  caption: string
  priceFormatter: (value: number) => string
  persistKey: string
}

/** O histórico de uma série de mercado, com o gráfico da visão do ativo.
 *
 *  Uma linha, e não candles: a maior parte das fontes só guarda o fechamento.
 *  Serve ao índice, à taxa de juro e ao câmbio — o que muda entre eles é a
 *  unidade, e ela chega pronta no formatador. */
export default function SeriesHistoryCard({ data, caption, priceFormatter, persistKey }: Props) {
  return (
    <AppCard>
      <AppStack gap="sm">
        <AppStack gap="xs">
          <SectionTitle>Histórico</SectionTitle>
          <AppText variant="caption" tone="secondary">
            {caption}
          </AppText>
        </AppStack>
        <CandleChart
          data={data}
          height={SERIES_CHART_HEIGHT}
          showRangePicker
          showTimeframeSelector
          showPriceScaleModeToggle
          showMeasureToggle
          showMovingAverageToggle
          showPerformance
          defaultRange="5y"
          defaultType="line"
          priceFormatter={priceFormatter}
          persistKey={persistKey}
        />
      </AppStack>
    </AppCard>
  )
}
