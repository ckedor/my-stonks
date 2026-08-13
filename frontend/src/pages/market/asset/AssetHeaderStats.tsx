import type { HistoricalCagr } from '@/api/market'
import { formatSpan } from '@/components/charts/candle/helpers'
import { Box, Stack, Typography } from '@mui/material'
import dayjs from 'dayjs'

/** What the asset did over its whole history, above the chart.
 *
 *  The rate is useless without its window -- 12% a year since 1998 is a
 *  different claim from 12% since 2023 -- so the start of the series sits
 *  beside it rather than being left for the reader to infer from the chart. */
export default function AssetHeaderStats({ cagr }: { cagr: HistoricalCagr | null }) {
  if (!cagr) return null

  const start = dayjs(cagr.start_date)
  const days = dayjs(cagr.end_date).diff(start, 'day')
  const percent = cagr.value * 100

  return (
    <Stack
      direction="row"
      spacing={3}
      sx={{ mt: 1.5, mb: 2, flexWrap: 'wrap', rowGap: 1.5 }}
    >
      <Stat label="CAGR histórico">
        <Typography
          sx={{
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1.2,
            color: percent >= 0 ? 'success.main' : 'error.main',
          }}
        >
          {percent >= 0 ? '+' : ''}
          {percent.toFixed(2).replace('.', ',')}% a.a.
        </Typography>
      </Stat>

      <Stat label="Início da série">
        <Typography sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
          {start.format('DD/MM/YYYY')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatSpan(days)} de histórico
        </Typography>
      </Stat>
    </Stack>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Box>{children}</Box>
    </Box>
  )
}
