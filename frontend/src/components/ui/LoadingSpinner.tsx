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

export default function LoadingSpinner() {
  return <CircularProgress size={24} />
}
