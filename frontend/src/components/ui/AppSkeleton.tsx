import { Skeleton } from '@mui/material'
import { useAppTheme } from './useAppTheme'

/* Retângulo cinza no lugar do que ainda não chegou.
 *
 * Ocupa o espaço exato do conteúdo final de propósito: é o que impede a
 * tela de saltar quando o dado carrega. */

export interface AppSkeletonProps {
  /** Largura em px; omitida, ocupa a do container. */
  width?: number | string
  /** Altura em px, ou uma medida CSS quando quem reserva não sabe o número —
   *  a área de gráfico que ocupa a altura do pai. */
  height: number | string
  /** `text` para linha de texto, `rounded` para bloco, `pill` para etiqueta
   *  totalmente arredondada, `circle` para o lugar de um avatar ou ícone
   *  redondo. Padrão: `rounded`. */
  shape?: 'text' | 'rounded' | 'pill' | 'circle'
}

export default function AppSkeleton({ width, height, shape = 'rounded' }: AppSkeletonProps) {
  const theme = useAppTheme()
  return (
    <Skeleton
      variant={shape === 'text' ? 'text' : shape === 'circle' ? 'circular' : 'rounded'}
      width={width ?? '100%'}
      height={height}
      sx={shape === 'pill' ? { borderRadius: `${theme.radius.pill}px` } : undefined}
    />
  )
}
