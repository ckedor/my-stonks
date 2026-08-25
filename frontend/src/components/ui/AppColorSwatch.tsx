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
/* O quadrado grande do catálogo de paleta, onde a cor é o assunto e não a
 * marca de outra coisa. */
const LARGE = 56

export interface AppColorSwatchProps {
  color: string
  /** `bar` para a marca ao lado do nome de uma série, `dot` para a de uma
   *  linha de tabela, `large` para o catálogo de paleta. Padrão: `square`. */
  shape?: 'square' | 'bar' | 'dot' | 'large'
}

export default function AppColorSwatch({ color, shape = 'square' }: AppColorSwatchProps) {
  const side = shape === 'dot' ? DOT : shape === 'large' ? LARGE : SIZE
  const size = shape === 'bar' ? BAR : { width: side, height: side }

  return (
    <Box
      sx={{
        ...size,
        flexShrink: 0,
        borderRadius: shape === 'dot' ? '50%' : '2px',
        bgcolor: color,
        /* A moldura só existe no tamanho grande: sem ela, um branco de fundo
           some contra a superfície do card e o catálogo mente. */
        ...(shape === 'large' ? { border: '1px solid', borderColor: 'divider' } : null),
      }}
    />
  )
}
