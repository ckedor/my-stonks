import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { useAppTheme } from './useAppTheme'

/* Moldura de aplicação: barra lateral, barra superior e a área que rola.
 *
 * É o único lugar que sabe que a tela inteira tem altura fixa e que o
 * conteúdo rola por dentro — detalhe que já derrubou um snapshot antes, e
 * que as telas não deveriam ter que conhecer. */

export interface AppShellProps {
  sidebar: ReactNode
  topbar: ReactNode
  children: ReactNode
  /** Largura reservada quando a barra lateral é fixa; 0 quando ela flutua. */
  sidebarOffset: number
  /** Empurra o conteúdo quando a barra lateral aberta é do tipo que flutua. */
  shiftedBy?: number
}

export default function AppShell({
  sidebar,
  topbar,
  children,
  sidebarOffset,
  shiftedBy = 0,
}: AppShellProps) {
  const theme = useAppTheme()

  return (
    <Box sx={{ display: 'flex' }}>
      {sidebar}

      {sidebarOffset > 0 && <Box sx={{ width: sidebarOffset, flexShrink: 0 }} />}

      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          ml: `${shiftedBy}px`,
          transition: theme.transitions.create('margin-left', {
            duration: theme.transitions.duration.enteringScreen,
          }),
        }}
      >
        {topbar}

        <Box px={4} pt={2} pb={1} sx={{ flexGrow: 1, overflow: 'auto' }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
