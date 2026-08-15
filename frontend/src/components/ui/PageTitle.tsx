import { Typography } from '@mui/material'
import type { ReactNode } from 'react'

/* Título de página.
 *
 * Existe para acabar com o h4/h5/h6 alternando entre telas: qual é o nível
 * do título de uma página é decisão do design system, tomada uma vez aqui.
 *
 * Não carrega margem — o espaçamento é do container, via `AppStack gap`.
 * Diferente do `PageHeader`, que lê o título do store de navegação; este é
 * para as telas que declaram o próprio título. */

export default function PageTitle({ children }: { children: ReactNode }) {
  return (
    <Typography variant="h5" component="h1">
      {children}
    </Typography>
  )
}
