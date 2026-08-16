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
}

export default function SectionTitle({ children }: SectionTitleProps) {
  return (
    <Typography variant="subtitle1" component="h2" fontWeight={600}>
      {children}
    </Typography>
  )
}
