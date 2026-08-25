import { Collapse } from '@mui/material'
import type { ReactNode } from 'react'

/* Trecho que abre e fecha abaixo do que o comanda — os ativos de uma
 * categoria na lista da visão geral.
 *
 * Desmonta o conteúdo ao fechar: a lista aberta pode ter dezenas de linhas, e
 * mantê-las montadas fora da tela é custo sem leitor. */

export interface AppCollapseProps {
  open: boolean
  children: ReactNode
}

export default function AppCollapse({ open, children }: AppCollapseProps) {
  return (
    <Collapse in={open} timeout="auto" unmountOnExit>
      {children}
    </Collapse>
  )
}
