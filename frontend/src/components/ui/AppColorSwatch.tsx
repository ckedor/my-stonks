import { Box } from '@mui/material'

/* Quadradinho da cor de uma série, ao lado do nome dela.
 *
 * A cor vem do dado — é a que o usuário escolheu para a categoria —, e o
 * quadrado existe para amarrar o nome à barra do gráfico. Pequeno de
 * propósito: ele identifica, não decora. */

const SIZE = 10
/* A barra vertical: a mesma marca ao lado do nome de uma série num gráfico de
 * linha, onde o quadrado se confunde com um ponto do desenho. */
const BAR = { width: 3, height: 16 }
/* O ponto: a mesma marca numa linha de tabela, onde o quadrado com canto vivo
 * compete com a grade da própria tabela. */
const DOT = 12

export interface AppColorSwatchProps {
  color: string
  /** `bar` para a marca ao lado do nome de uma série, `dot` para a de uma
   *  linha de tabela. Padrão: `square`. */
  shape?: 'square' | 'bar' | 'dot'
}

export default function AppColorSwatch({ color, shape = 'square' }: AppColorSwatchProps) {
  const size =
    shape === 'bar' ? BAR : shape === 'dot' ? { width: DOT, height: DOT } : { width: SIZE, height: SIZE }
  return (
    <Box
      sx={{
        ...size,
        flexShrink: 0,
        borderRadius: shape === 'dot' ? '50%' : '2px',
        bgcolor: color,
      }}
    />
  )
}
