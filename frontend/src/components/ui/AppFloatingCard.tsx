import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { space } from '@/theme/tokens'
import { useAppTheme } from './useAppTheme'

/* Balão que aparece sobre o conteúdo, na posição que quem chama calcula.
 *
 * A posição vem de fora porque só quem desenha sabe onde o cursor está e
 * onde ficam as bordas do desenho. O que mora aqui é o resto: a superfície,
 * a sombra, e o `pointerEvents: none` — sem ele o balão rouba o cursor do
 * gráfico e pisca ao aparecer debaixo dele. */

export interface AppFloatingCardProps {
  /** Distância, em px, das bordas do container posicionado. */
  left: number
  top: number
  width: number
  children: ReactNode
}

export default function AppFloatingCard({ left, top, width, children }: AppFloatingCardProps) {
  const theme = useAppTheme()
  return (
    <Box
      sx={{
        position: 'absolute',
        left,
        top,
        width,
        pointerEvents: 'none',
        zIndex: 3,
        p: space.sm,
        borderRadius: `${theme.radius.sm}px`,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: 3,
      }}
    >
      {children}
    </Box>
  )
}
