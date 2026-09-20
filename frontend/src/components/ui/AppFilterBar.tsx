import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { space } from '@/theme/tokens'

/** A compact surface for related filters, wrapping as the viewport narrows. */
export default function AppFilterBar({ children }: { children: ReactNode }) {
  return (
    <Box
      role="group"
      aria-label="Filtros da listagem"
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: space.sm,
        p: space.md,
        width: '100%',
        boxSizing: 'border-box',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${theme.radius.lg}px`,
        '& > *': { minWidth: 0 },
        [theme.breakpoints.down('sm')]: {
          '& > *': { flex: '1 1 180px' },
          '& > :first-child': { flexBasis: '100%', width: '100%' },
        },
      })}
    >
      {children}
    </Box>
  )
}
