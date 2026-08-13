import type { FIIIndicators } from '@/api/market'
import AppCard from '@/components/ui/AppCard'
import { Box, Stack, Tooltip, Typography } from '@mui/material'
import {
  EMPTY,
  formatBRL,
  formatCompactBRL,
  formatCompactCount,
  formatDate,
  formatMultiple,
  formatPercent,
} from './format'

interface Stat {
  label: string
  value: string
  hint?: string
}

/** Only the first letter is touched. The provider writes "tijolo" lower case
 *  and "Shoppings" capitalized, but capitalizing every word would turn
 *  "Fundo de fundos" into "Fundo De Fundos". */
const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

/** The fund's kind, broad to narrow: strategy, then where it invests.
 *
 *  The two collapse into one when the provider says the same thing twice --
 *  a paper fund whose segment is also its strategy should read "Papel", not
 *  "Papel · Papel". */
function classify(indicators: FIIIndicators): string {
  const parts = [indicators.segment_type, indicators.segment]
    .filter((part): part is string => Boolean(part))
    .map((part) => sentenceCase(part.trim()))
  return [...new Set(parts)].join(' · ')
}

/** One published number, with the room its label needs and no more. */
function StatTile({ label, value, hint }: Stat) {
  const heading = (
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{
        whiteSpace: 'nowrap',
        ...(hint && { borderBottom: '1px dotted', borderColor: 'text.disabled', cursor: 'help' }),
      }}
    >
      {label}
    </Typography>
  )

  return (
    <Box sx={{ minWidth: 0 }}>
      {hint ? <Tooltip title={hint}>{heading}</Tooltip> : heading}
      <Typography fontWeight="bold" sx={{ color: value === EMPTY ? 'text.disabled' : 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  )
}

/** What the fund reports about itself.
 *
 *  What kind of fund it is and when it last reported sit above the numbers
 *  rather than among them: they are the frame the numbers are read in, not
 *  measurements, and a segment laid out as a statistic reads as one. */
export default function FIIIndicatorsCard({ indicators }: { indicators: FIIIndicators }) {
  const classification = classify(indicators)

  const stats: Stat[] = [
    {
      label: 'P/VP',
      value: formatMultiple(indicators.price_to_nav),
      hint: 'Preço da cota dividido pelo seu valor patrimonial. Abaixo de 1x, a cota negocia por menos do que o fundo declara valer',
    },
    {
      label: 'DY 12 meses',
      value: formatPercent(indicators.dividend_yield_12m),
      hint: 'Rendimentos distribuídos nos últimos 12 meses sobre o preço atual da cota',
    },
    { label: 'DY no mês', value: formatPercent(indicators.dividend_yield_1m) },
    { label: 'Retorno no mês', value: formatPercent(indicators.monthly_return) },
    { label: 'Cota', value: formatBRL(indicators.price) },
    {
      label: 'Valor patrimonial',
      value: formatBRL(indicators.nav_per_share),
      hint: 'Patrimônio do fundo dividido pelo número de cotas',
    },
    { label: 'Patrimônio líquido', value: formatCompactBRL(indicators.equity) },
    { label: 'Ativos totais', value: formatCompactBRL(indicators.total_assets) },
    { label: 'Cotas emitidas', value: formatCompactCount(indicators.shares_outstanding) },
    { label: 'Cotistas', value: formatCompactCount(indicators.shareholders) },
  ]

  return (
    <AppCard>
      <Stack
        direction="row"
        alignItems="baseline"
        justifyContent="space-between"
        flexWrap="wrap"
        rowGap={0.5}
        columnGap={2}
      >
        <Typography variant="h6">Indicadores do fundo</Typography>
        {indicators.as_of_date && (
          <Typography variant="caption" color="text.secondary">
            Dados de {formatDate(indicators.as_of_date)}
          </Typography>
        )}
      </Stack>

      {/* What kind of fund this is, as one line in the register of a subtitle.
          Chips would set it as two parallel tags to be picked from, which is
          not what it is: the strategy and the segment are one classification
          read from broad to narrow, and nothing here is filterable. The words
          are the provider's own, not the segment catalogue the application
          keeps for registered funds. */}
      {classification && (
        <Typography variant="body2" color="text.secondary">
          {classification}
        </Typography>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          mt: 2,
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(3, minmax(0, 1fr))',
            md: 'repeat(5, minmax(0, 1fr))',
          },
        }}
      >
        {stats.map((stat) => (
          <StatTile key={stat.label} {...stat} />
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Valores em reais, como publicados pelo fundo.
      </Typography>
    </AppCard>
  )
}
