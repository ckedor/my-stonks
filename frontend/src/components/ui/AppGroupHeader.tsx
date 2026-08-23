import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { space } from '@/theme/tokens'
import { useAppTheme } from './useAppTheme'

/* Cabeçalho de um grupo dentro de uma lista longa — a categoria acima dos
 * ativos dela.
 *
 * Não é `SectionTitle`: aquele nomeia um bloco da página, e a régua colorida
 * daqui não é enfeite — é a cor da categoria, que amarra o grupo ao que a
 * pizza e os gráficos desenham com a mesma cor. */

export interface AppGroupHeaderProps {
  title: string
  /** Cor do assunto do grupo — a da categoria. */
  color: string
  /** Torna o título clicável: o grupo tem uma página própria. */
  onTitleClick?: () => void
  /** Ao lado direito, o total do grupo. */
  trailing?: ReactNode
}

export default function AppGroupHeader({
  title,
  color,
  onTitleClick,
  trailing,
}: AppGroupHeaderProps) {
  const theme = useAppTheme()

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: space.sm,
        pb: space.xs,
        borderBottom: `2px solid ${color}`,
      }}
    >
      <Box
        sx={{
          width: 6,
          height: 20,
          borderRadius: `${theme.radius.sm}px`,
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <Typography
        variant="subtitle2"
        onClick={onTitleClick}
        sx={{
          flex: 1,
          fontWeight: 700,
          textTransform: 'uppercase',
          ...(onTitleClick ? { cursor: 'pointer', '&:hover': { textDecoration: 'underline' } } : null),
        }}
      >
        {title}
      </Typography>
      {trailing}
    </Box>
  )
}
