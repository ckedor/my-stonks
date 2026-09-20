import { Typography } from '@mui/material'
import type { ReactNode } from 'react'

/* Título de um bloco dentro da página — o cabeçalho de um card ou de uma
 * seção, um degrau abaixo do `PageTitle`.
 *
 * Existe pelo mesmo motivo do `PageTitle`: as telas alternavam entre
 * `subtitle1` + `fontWeight: 600`, `subtitle2` e `h6` para dizer a mesma
 * coisa. Qual é o nível de um título de seção é decisão do design system,
 * tomada uma vez aqui.
 *
 * Não carrega margem — o espaçamento vem do `AppStack gap` do container. */

export interface SectionTitleProps {
  children: ReactNode
  /** Editorial lead, when the section introduces a complete reading. */
  prominence?: 'standard' | 'lead'
}

export default function SectionTitle({ children, prominence = 'standard' }: SectionTitleProps) {
  return (
    <Typography
      variant="subtitle1"
      component="h2"
      fontWeight={prominence === 'lead' ? 700 : 600}
      sx={
        prominence === 'lead'
          ? {
              fontSize: { xs: '1.75rem', md: '2.5rem' },
              lineHeight: 1.15,
              letterSpacing: '-0.035em',
              maxWidth: '26ch',
              textWrap: 'balance',
            }
          : undefined
      }
    >
      {children}
    </Typography>
  )
}
