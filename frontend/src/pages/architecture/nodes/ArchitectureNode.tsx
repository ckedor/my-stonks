import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Box, Typography, useTheme } from '@mui/material'

import type { ArchitectureNode as ArchitectureNodeType } from '../graph/types'

const accentByKind = {
  scheduler: '#7c5ce5',
  task: '#3f7cac',
  module: '#8b5e34',
  service: '#27896f',
  database: '#b66a2c',
  cache: '#b33f62',
  external: '#68717d',
} as const

export default function ArchitectureNode({ data }: NodeProps<ArchitectureNodeType>) {
  const theme = useTheme()
  const accent = accentByKind[data.kind]

  return (
    <Box
      sx={{
        width: 220,
        minHeight: 104,
        border: `1px solid ${theme.palette.divider}`,
        borderLeft: `5px solid ${accent}`,
        borderRadius: 2,
        bgcolor: 'background.paper',
        color: 'text.primary',
        px: 1.5,
        py: 1.25,
        boxShadow: theme.shadows[2],
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Typography sx={{ fontSize: 13, fontWeight: 750, lineHeight: 1.25 }}>
        {data.title}
      </Typography>
      <Typography
        sx={{
          mt: 0.4,
          color: accent,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 0.8,
        }}
      >
        {data.subtitle ?? data.kind.toUpperCase()}
      </Typography>
      {data.details?.map((detail) => (
        <Typography key={detail} sx={{ mt: 0.25, color: 'text.secondary', fontSize: 10.5 }}>
          {detail}
        </Typography>
      ))}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  )
}
