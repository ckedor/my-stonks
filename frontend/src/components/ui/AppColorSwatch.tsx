import { Box } from '@mui/material'

/* Quadradinho da cor de uma série, ao lado do nome dela.
 *
 * A cor vem do dado — é a que o usuário escolheu para a categoria —, e o
 * quadrado existe para amarrar o nome à barra do gráfico. Pequeno de
 * propósito: ele identifica, não decora. */

const SIZE = 10

export interface AppColorSwatchProps {
  color: string
}

export default function AppColorSwatch({ color }: AppColorSwatchProps) {
  return <Box sx={{ width: SIZE, height: SIZE, borderRadius: '2px', bgcolor: color }} />
}
