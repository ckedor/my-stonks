import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import AppText from './AppText'

/* Moldura de gráfico: controles em cima, desenho embaixo, altura conhecida.
 *
 * A altura vem de fora e é declarada de propósito — o container do recharts
 * mede o pai para se dimensionar, e um pai que cresce com o conteúdo mede
 * zero na primeira pintura: o gráfico nasce sem altura e nunca se recupera.
 *
 * `sizing` diz a qual dos dois a altura pertence, e as duas formas existem
 * no app: `chart` reserva a altura para o desenho e deixa a moldura crescer
 * com os controles; `frame` fixa a moldura inteira e o desenho ocupa o que
 * sobra — é o que serve dentro de um card de altura fixa.
 *
 * `emptyMessage` ocupa a mesma altura em vez de sumir: a faixa que encolhe
 * quando não há dado faz o resto da página saltar. */

export interface AppChartAreaProps {
  height: number | string
  /** Padrão: `chart`. */
  sizing?: 'chart' | 'frame'
  /** Controles acima do desenho — título, período, agrupamento. */
  toolbar?: ReactNode
  /** Mostrado, centrado, quando não há o que desenhar. */
  emptyMessage?: string
  children?: ReactNode
}

export default function AppChartArea({
  height,
  sizing = 'chart',
  toolbar,
  emptyMessage,
  children,
}: AppChartAreaProps) {
  if (emptyMessage) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AppText tone="secondary">{emptyMessage}</AppText>
      </Box>
    )
  }

  const plot = (
    <Box
      sx={
        sizing === 'frame'
          ? { flex: 1, minHeight: 0, position: 'relative' }
          : { height, position: 'relative' }
      }
    >
      {children}
    </Box>
  )

  if (!toolbar && sizing === 'chart') return plot

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        ...(sizing === 'frame' ? { height, minHeight: 0 } : null),
      }}
    >
      {toolbar}
      {plot}
    </Box>
  )
}
