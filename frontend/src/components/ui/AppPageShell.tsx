import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { CONTENT_MAX_WIDTH } from './AppTopbar'

/* Moldura das telas do app: barra superior e uma faixa central de conteúdo.
 *
 * Irmã do `AppShell`, e a diferença entre as duas é de rolagem, não de
 * decoração. O `AppShell` do admin trava a altura em `100vh` e rola por
 * dentro, porque a barra lateral precisa ficar parada. Aqui não há barra
 * lateral: a página rola inteira, com a barra superior subindo junto.
 *
 * A largura máxima é a mesma da barra, para que o conteúdo e as abas
 * comecem na mesma coluna. */

export interface AppPageShellProps {
  topbar: ReactNode
  children: ReactNode
}

export default function AppPageShell({ topbar, children }: AppPageShellProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {topbar}

      <Box
        px={4}
        py={2}
        sx={{ flexGrow: 1, maxWidth: CONTENT_MAX_WIDTH, width: '100%', mx: 'auto' }}
      >
        {children}
      </Box>
    </Box>
  )
}
