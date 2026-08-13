import type { HistoricalCagr } from '@/api/market'
import { Box, Tooltip, Typography } from '@mui/material'
import dayjs from 'dayjs'

/** What the asset compounded over its whole history, under its name.
 *
 *  One line, in the register of the subtitle above it: the header is there to
 *  name the asset, and a rate set in tiles and uppercase labels competes with
 *  the chart for attention it does not deserve. The start of the series is
 *  part of the same sentence because the rate does not mean anything without
 *  it -- 51% a year since 2010 is a different claim from 51% since 2023. */
export default function AssetHeaderStats({ cagr }: { cagr: HistoricalCagr | null }) {
  if (!cagr) return null

  const percent = cagr.value * 100
  const formatted = `${percent >= 0 ? '+' : ''}${percent.toFixed(2).replace('.', ',')}%`

  return (
    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
      <Tooltip title="Calculado sobre o fechamento ajustado por proventos e desdobramentos">
        <Box
          component="span"
          sx={{ borderBottom: '1px dotted', borderColor: 'text.disabled', cursor: 'help' }}
        >
          CAGR
        </Box>
      </Tooltip>{' '}
      <Typography
        component="span"
        variant="body2"
        sx={{ fontWeight: 600, color: percent >= 0 ? 'success.main' : 'error.main' }}
      >
        {formatted} a.a.
      </Typography>
      {' desde '}
      {dayjs(cagr.start_date).format('DD/MM/YYYY')}
    </Typography>
  )
}
