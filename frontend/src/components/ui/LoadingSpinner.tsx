import { Box, CircularProgress } from '@mui/material'

/* Espera.
 *
 * `block` ocupa a tela e centraliza — é a página que ainda não tem o que
 * mostrar. `inline` cabe numa linha, no lugar exato do conteúdo que ainda
 * não chegou, sem mover o que está em volta. */

export interface LoadingSpinnerProps {
  /** Padrão: `block`. */
  variant?: 'block' | 'inline'
}

export default function LoadingSpinner({ variant = 'block' }: LoadingSpinnerProps) {
  if (variant === 'inline') return <CircularProgress size={24} />

  return (
    <Box minHeight="80vh" display="flex" justifyContent="center" alignItems="center">
      <CircularProgress size={48} thickness={4} />
    </Box>
  )
}
