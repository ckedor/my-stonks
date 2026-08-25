import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { space, type SpaceToken } from '@/theme/tokens'
import { useAppTheme } from './useAppTheme'

/* Linha de uma lista onde uma está escolhida — as categorias da carteira na
 * visão geral, e os ativos que cada uma abre.
 *
 * Não é `AppCard interactive`: um card traz borda e superfície própria, e uma
 * pilha deles vira uma escada de molduras onde o que se quer é uma lista. O
 * que esta linha desenha é só o realce: fundo no hover, fundo mais firme na
 * escolhida.
 *
 * Sem `AppStack` por dentro para não fixar o eixo: quem usa compõe o miolo
 * com o stack que precisar. */

export interface AppListRowProps {
  children: ReactNode
  /** Realce permanente da linha escolhida. */
  selected?: boolean
  onClick?: () => void
  /** Espaçamento vertical. `md` é a linha principal, `sm` a de dentro de uma
   *  linha aberta. Padrão: `md`. */
  padding?: Extract<SpaceToken, 'sm' | 'md'>
}

export default function AppListRow({
  children,
  selected = false,
  onClick,
  padding = 'md',
}: AppListRowProps) {
  const theme = useAppTheme()

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        py: padding === 'md' ? space.md : space.xs,
        px: space.xs,
        borderRadius: `${theme.radius.sm}px`,
        backgroundColor: selected ? 'action.selected' : 'transparent',
        ...(onClick
          ? { cursor: 'pointer', transition: 'background-color 0.15s', '&:hover': { backgroundColor: 'action.hover' } }
          : null),
      }}
    >
      {children}
    </Box>
  )
}
