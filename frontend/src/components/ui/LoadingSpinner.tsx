import { CircularProgress } from '@mui/material'

/* Espera em linha, no lugar exato do controle que está trabalhando — o
 * botão de recalcular enquanto recalcula, a carteira sendo trocada na
 * barra do topo.
 *
 * Não existe variante de tela cheia, e a falta é a regra: o que uma página
 * mostra enquanto carrega é a reserva do que vai chegar (`AppSkeleton` e os
 * `*Skeleton` construídos com ele), não um disco girando no meio do vazio.
 * O spinner responde por uma ação que alguém acabou de disparar; o
 * esqueleto responde pelo conteúdo que ainda não chegou. */

export interface LoadingSpinnerProps {
  /** `sm` é o tamanho de um ícone de botão ou de item de menu, onde ele entra
   *  no lugar do ícone. Padrão: `md`. */
  size?: 'sm' | 'md'
}

const SIZES = { sm: 18, md: 24 } as const

export default function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  return <CircularProgress size={SIZES[size]} color="inherit" />
}
