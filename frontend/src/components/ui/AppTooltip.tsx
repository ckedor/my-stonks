import { Tooltip } from '@mui/material'
import type { ReactNode } from 'react'

/* Texto que aparece ao passar o mouse.
 *
 * Serve para o detalhe que não cabe na tela mas não pode sumir — o JSON de
 * parâmetros de uma tentativa de importação, truncado na célula e inteiro
 * aqui. `whiteSpace: pre-wrap` porque esse conteúdo costuma vir com quebra
 * de linha própria, e sem isso o tooltip a engoliria. */

export interface AppTooltipProps {
  /** Conteúdo do balão. */
  title: string
  children: ReactNode
}

export default function AppTooltip({ title, children }: AppTooltipProps) {
  return (
    <Tooltip title={title} slotProps={{ tooltip: { sx: { whiteSpace: 'pre-wrap' } } }}>
      <span>{children}</span>
    </Tooltip>
  )
}
