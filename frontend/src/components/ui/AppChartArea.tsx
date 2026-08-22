import { Box } from '@mui/material'
import { space } from '@/theme/tokens'
import type { ReactNode, Ref } from 'react'
import AppText from './AppText'
import LoadingSpinner from './LoadingSpinner'

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
 * quando não há dado faz o resto da página saltar.
 *
 * Sem `height`, a área cresce com o que estiver dentro — é o que serve para
 * as bibliotecas de canvas, que criam o próprio elemento com a altura que
 * receberam e não medem o pai. Para elas, `plotRef` entrega o nó onde
 * desenhar. */

export interface AppChartAreaProps {
  /** Omitida, a área cresce com o conteúdo. */
  height?: number | string
  /** Padrão: `chart`. */
  sizing?: 'chart' | 'frame'
  /** Controles acima do desenho — título, período, agrupamento. */
  toolbar?: ReactNode
  /** Reserva a altura e mostra que o dado está a caminho. */
  loading?: boolean
  /** Mostrado, centrado, quando não há o que desenhar. */
  emptyMessage?: string
  /** Texto curto no canto superior esquerdo do desenho — o ano que o eixo
   *  de meses não diz. */
  note?: string
  /** Nó onde uma biblioteca de canvas desenha. */
  plotRef?: Ref<HTMLDivElement>
  /** Posicionado por cima do desenho — um balão que segue o cursor. */
  overlay?: ReactNode
  children?: ReactNode
}

export default function AppChartArea({
  height,
  sizing = 'chart',
  toolbar,
  loading = false,
  emptyMessage,
  note,
  plotRef,
  overlay,
  children,
}: AppChartAreaProps) {
  if (loading || emptyMessage) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? <LoadingSpinner variant="inline" /> : <AppText tone="secondary">{emptyMessage}</AppText>}
      </Box>
    )
  }

  const plot = (
    <Box
      sx={
        sizing === 'frame'
          ? { flex: 1, minHeight: 0, position: 'relative' }
          : { width: '100%', ...(height ? { height } : null), position: 'relative' }
      }
    >
      {/* O nó da biblioteca de canvas é irmão do overlay, não pai: ela
          apaga e recria o que está dentro do próprio nó, e levaria o balão
          junto a cada redesenho. */}
      {note && (
        <Box sx={{ position: 'absolute', top: -2, left: 56, zIndex: 1 }}>
          <AppText variant="caption" tone="secondary">
            {note}
          </AppText>
        </Box>
      )}
      {plotRef ? <Box ref={plotRef} sx={{ width: '100%' }} /> : children}
      {overlay}
    </Box>
  )

  if (!toolbar && sizing === 'chart') return plot

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: space.sm,
        ...(sizing === 'frame' ? { height, minHeight: 0 } : null),
      }}
    >
      {toolbar}
      {plot}
    </Box>
  )
}
