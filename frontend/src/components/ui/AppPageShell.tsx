import { Box } from '@mui/material'
import type { ReactNode } from 'react'

/* Moldura das telas do app: barra superior, coluna de navegação e o
 * conteúdo.
 *
 * Irmã do `AppShell`, e a diferença entre as duas é de rolagem, não de
 * decoração. O `AppShell` do admin trava a altura em `100vh` e rola por
 * dentro, porque a barra lateral precisa ficar parada. Aqui a página rola
 * inteira, com a barra superior subindo junto — a coluna de navegação fica
 * parada por `position: sticky`, dentro do próprio componente.
 *
 * A coluna encosta na borda esquerda da janela, e quem se centraliza é só o
 * conteúdo, no espaço que sobra. Foi o contrário por um tempo — coluna e
 * conteúdo dentro da mesma faixa central — e o resultado era uma barra
 * lateral flutuando com uma margem à esquerda, que não se lia como moldura
 * de nada. Sem a coluna (tela estreita), a faixa se centraliza na janela
 * inteira, que é o respiro que ela sempre teve. */

/** O conteúdo para de crescer aqui: numa tela ultralarga, uma tabela que vai
 *  de borda a borda obriga o olho a percorrer a linha inteira. */
const CONTENT_MAX_WIDTH = 1600

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

      <Box sx={{ display: 'flex', flexGrow: 1 }}>
        {sidebar}

        {/* Respiro maior no topo que embaixo: o conteúdo colado na barra a
            fazia parecer parte da primeira linha da página em vez de
            moldura dela. */}
        <Box
          px={4}
          pt={5}
          pb={2}
          sx={{ flexGrow: 1, minWidth: 0, maxWidth: CONTENT_MAX_WIDTH, mx: 'auto' }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}
