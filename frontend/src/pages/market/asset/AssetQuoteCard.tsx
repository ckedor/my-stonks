import type { CandleDataPoint } from '@/components/charts/CandleChart'
import CandleChart from '@/components/charts/CandleChart'
import { AppCard, AppStack, SectionTitle } from '@/components/ui'

export const QUOTE_CHART_HEIGHT = 500

interface Props {
  data: CandleDataPoint[]
  /** Identifies the chart's saved toolbar state. */
  persistKey: string
  priceFormatter: (value: number) => string
}

/** The price chart, which every asset type shows.
 *
 *  It lives on its own so the per-type views below compose it instead of
 *  restating a dozen toolbar flags each: the chart is the one part of the
 *  market page that does not vary with what is being looked at. */
export default function AssetQuoteCard({ data, persistKey, priceFormatter }: Props) {
  return (
    <AppCard>
      <AppStack gap="sm">
        {/* A heading element, not `AppCard title`: that prop is spread onto the
            Box and becomes the DOM title attribute, so it only ever showed as a
            browser tooltip -- while the page skeleton has always reserved a line
            of space for a visible one. */}
        <SectionTitle>Cotação</SectionTitle>
        <CandleChart
          data={data}
          height={QUOTE_CHART_HEIGHT}
          showVolume
          showVolumeToggle
          showRangePicker
          showTimeframeSelector
          showTypeToggle
          showPriceSeriesToggle
          showPriceScaleModeToggle
          showMeasureToggle
          showMovingAverageToggle
          showPerformance
          defaultRange="1y"
          priceFormatter={priceFormatter}
          persistKey={persistKey}
        />
      </AppStack>
    </AppCard>
  )
}
