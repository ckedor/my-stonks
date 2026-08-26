import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { CONTENT_MAX_WIDTH } from './AppTopbar'

/* Moldura das telas do app: barra superior, coluna de navegação e o
 * conteúdo.
 *
 * Irmã do `AppShell`, e a diferença entre as duas é de rolagem, não de
 * decoração. O `AppShell` do admin trava a altura em `100vh` e rola por
 * dentro, porque a barra lateral precisa ficar parada. Aqui a página rola
 * inteira, com a barra superior subindo junto — a coluna de navegação fica
 * parada por `position: sticky`, dentro do próprio componente.
 *
 * A coluna mora *dentro* da faixa central, não colada na borda da janela:
 * assim a marca na barra superior cai sobre ela e o app inteiro se lê como
 * uma moldura só, em vez de uma barra lateral com um cabeçalho deslocado. */

export interface AppPageShellProps {
  topbar: ReactNode
  /** Coluna de navegação à esquerda do conteúdo. Ausente na tela estreita,
   *  onde a navegação vira o drawer da barra superior. */
  sidebar?: ReactNode
  children: ReactNode
}

export default function AppPageShell({ topbar, sidebar, children }: AppPageShellProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {topbar}

      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          maxWidth: CONTENT_MAX_WIDTH,
          width: '100%',
          mx: 'auto',
        }}
      >
        {sidebar}

        {/* Respiro maior no topo que embaixo: o conteúdo colado na barra a
            fazia parecer parte da primeira linha da página em vez de
            moldura dela. */}
        <Box px={4} pt={5} pb={2} sx={{ flexGrow: 1, minWidth: 0 }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
