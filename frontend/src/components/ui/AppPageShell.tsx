import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { space } from '@/theme/tokens'
import { TOPBAR_HEIGHT } from './AppTopbar'

/* Moldura de toda tela: barra superior, coluna de navegação, o conteúdo e,
 * quando a tela pede, um painel à direita.
 *
 * É a única moldura do app — a carteira, o admin e as ferramentas de dev
 * abrem dentro dela. A página rola inteira, com a barra superior grudada no
 * topo; a coluna de navegação e o painel ficam parados por
 * `position: sticky`.
 *
 * A coluna encosta na borda esquerda da janela, e quem se centraliza é só o
 * conteúdo, no espaço que sobra. Foi o contrário por um tempo — coluna e
 * conteúdo dentro da mesma faixa central — e o resultado era uma barra
 * lateral flutuando com uma margem à esquerda, que não se lia como moldura
 * de nada. Sem a coluna (tela estreita), a faixa se centraliza na janela
 * inteira, que é o respiro que ela sempre teve.
 *
 * Pinta o próprio fundo, em vez de deixar o do `body` aparecer: sob outro
 * `ThemeProvider` — o do estúdio de temas, em `tools/` —, é o que faz o tema
 * em edição chegar à página inteira, e não só aos componentes dela. */

/** O conteúdo para de crescer aqui: numa tela ultralarga, uma tabela que vai
 *  de borda a borda obriga o olho a percorrer a linha inteira. */
const CONTENT_MAX_WIDTH = 1600

const ASIDE_WIDTH = 340

export interface AppPageShellProps {
  topbar: ReactNode
  /** Coluna de navegação à esquerda do conteúdo. Ausente na tela estreita,
   *  onde a navegação vira o drawer da barra superior. */
  sidebar?: ReactNode
  /** Painel de controles à direita, para quando se mexe num lado e se olha o
   *  efeito no outro: os dois ficam na tela ao mesmo tempo. Não é um drawer,
   *  que abre por cima e tira o conteúdo de alcance. */
  aside?: { label: string; content: ReactNode }
  children: ReactNode
}

export default function AppPageShell({ topbar, sidebar, aside, children }: AppPageShellProps) {
  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'text.primary',
        fontFamily: theme.typography.fontFamily,
      })}
    >
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

        {/* Duas caixas, como na coluna de navegação: a de fora leva o fio até
            o fim da página, a de dentro gruda e rola sozinha quando é mais
            alta que a janela. */}
        {aside && (
          <Box
            component="aside"
            aria-label={aside.label}
            sx={{
              width: ASIDE_WIDTH,
              flexShrink: 0,
              borderLeft: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Box
              sx={{
                position: 'sticky',
                top: TOPBAR_HEIGHT,
                maxHeight: `calc(100vh - ${TOPBAR_HEIGHT}px)`,
                overflowY: 'auto',
                p: space.md,
                scrollbarWidth: 'thin',
              }}
            >
              {aside.content}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}
