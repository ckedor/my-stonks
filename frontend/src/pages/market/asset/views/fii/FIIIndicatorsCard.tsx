import type { FIIIndicators } from '@/api/market'
import AppCard from '@/components/ui/AppCard'
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material'
import {
  EMPTY,
  formatBRL,
  formatCompactBRL,
  formatCompactCount,
  formatDate,
  formatPercent,
  formatRatio,
} from './format'

interface Stat {
  label: string
  value: string
  hint?: string
  emphasis?: boolean
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
 *  The identity of the fund -- its segment, who runs it, when it last reported
 *  -- sits above the numbers rather than among them: it is the frame the
 *  numbers are read in, and a manager's name laid out as a statistic reads as
 *  one. */
export default function FIIIndicatorsCard({ indicators }: { indicators: FIIIndicators }) {
  const stats: Stat[] = [
    {
      label: 'P/VP',
      value: formatRatio(indicators.price_to_book),
      hint: 'Preço da cota dividido pelo seu valor patrimonial. Abaixo de 1, a cota negocia por menos do que o fundo declara valer',
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
      value: formatBRL(indicators.book_value_per_share),
      hint: 'Patrimônio do fundo dividido pelo número de cotas',
    },
    { label: 'Patrimônio líquido', value: formatCompactBRL(indicators.equity) },
    { label: 'Ativos totais', value: formatCompactBRL(indicators.total_assets) },
    { label: 'Cotas emitidas', value: formatCompactCount(indicators.shares_outstanding) },
    { label: 'Cotistas', value: formatCompactCount(indicators.shareholders) },
  ]

  const management = [indicators.manager, indicators.administrator].filter(Boolean).join(' · ')

  return (
    <AppCard>
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Indicadores do fundo
      </Typography>

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        rowGap={1}
        columnGap={2}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
          {indicators.segment_type && (
            <Chip size="small" label={indicators.segment_type} variant="outlined" />
          )}
          {indicators.segment && <Chip size="small" label={indicators.segment} />}
          {management && (
            <Typography variant="body2" color="text.secondary">
              {management}
            </Typography>
          )}
        </Stack>
        {indicators.as_of_date && (
          <Typography variant="caption" color="text.secondary">
            Dados de {formatDate(indicators.as_of_date)}
          </Typography>
        )}
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
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
