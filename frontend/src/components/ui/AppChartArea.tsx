import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import AppText from './AppText'

/* Área de altura fixa onde um gráfico é desenhado.
 *
 * A altura vem de fora e é fixa de propósito: o container do recharts mede o
 * pai para se dimensionar, e um pai que cresce com o conteúdo mede zero na
 * primeira pintura — o gráfico nasce sem altura e nunca se recupera.
 *
 * `emptyMessage` ocupa a mesma altura em vez de sumir: a faixa que encolhe
 * quando não há dado faz o resto da página saltar. */

export interface AppChartAreaProps {
  height: number
  /** Mostrado, centrado, quando não há o que desenhar. */
  emptyMessage?: string
  children?: ReactNode
}

export default function AppChartArea({ height, emptyMessage, children }: AppChartAreaProps) {
  if (emptyMessage) {
    return (
      <Box
        sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <AppText tone="secondary">{emptyMessage}</AppText>
      </Box>
    )
  }

  return <Box sx={{ position: 'relative', height }}>{children}</Box>
}
