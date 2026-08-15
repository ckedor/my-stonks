import { Box, CircularProgress, Typography } from '@mui/material'

interface Props {
  /** Percentual, de 0 a 100. */
  value: number
  color: string
  size?: number
}

/** Uma fatia com o número dentro: o peso de um ativo na carteira, do mesmo
 *  jeito na lista e nos cards. */
export default function MiniDonut({ value, color, size = 32 }: Props) {
  const pct = Math.max(0, Math.min(100, value))

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={size}
        thickness={4}
        sx={{ color: 'action.hover', position: 'absolute' }}
      />
      <CircularProgress
        variant="determinate"
        value={pct}
        size={size}
        thickness={4}
        sx={{ color, position: 'absolute' }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontSize: size <= 32 ? 8 : 10, fontWeight: 700, lineHeight: 1 }}>
          {pct < 1 ? '<1' : Math.round(pct)}%
        </Typography>
      </Box>
    </Box>
  )
}
