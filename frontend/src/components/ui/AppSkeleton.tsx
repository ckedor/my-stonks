import { Skeleton } from '@mui/material'
import { radius } from '@/theme/tokens'

/* Retângulo cinza no lugar do que ainda não chegou.
 *
 * Ocupa o espaço exato do conteúdo final de propósito: é o que impede a
 * tela de saltar quando o dado carrega. */

export interface AppSkeletonProps {
  /** Largura em px; omitida, ocupa a do container. */
  width?: number
  height: number
  /** `text` para linha de texto, `rounded` para bloco, `pill` para etiqueta
   *  totalmente arredondada. Padrão: `rounded`. */
  shape?: 'text' | 'rounded' | 'pill'
}

export default function AppSkeleton({ width, height, shape = 'rounded' }: AppSkeletonProps) {
  return (
    <Skeleton
      variant={shape === 'text' ? 'text' : 'rounded'}
      width={width ?? '100%'}
      height={height}
      sx={shape === 'pill' ? { borderRadius: `${radius.pill}px` } : undefined}
    />
  )
}
