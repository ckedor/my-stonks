import { Typography } from '@mui/material'
import { space } from '@/theme/tokens'

/* Lista de frases curtas com marcador.
 *
 * Sai como `ul`/`li` de verdade, e não como uma pilha de textos com um traço
 * na frente: quem lê por leitor de tela ouve quantos itens há e onde a lista
 * termina, e isso é informação, não decoração. */

export interface AppBulletListProps {
  items: string[]
  /** Padrão: `bodySmall`. */
  variant?: 'body' | 'bodySmall'
  /** Padrão: `secondary`. */
  tone?: 'default' | 'secondary'
}

export default function AppBulletList({
  items,
  variant = 'bodySmall',
  tone = 'secondary',
}: AppBulletListProps) {
  return (
    <Typography
      component="ul"
      variant={variant === 'body' ? 'body1' : 'body2'}
      color={tone === 'secondary' ? 'text.secondary' : undefined}
      sx={{ m: 0, pl: space.md, display: 'flex', flexDirection: 'column', gap: space.xs }}
    >
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </Typography>
  )
}
