import { Box } from '@mui/material'
import { useState } from 'react'

/* Ilustração decorativa — a arte do personagem de uma patente.
 *
 * Renderiza sempre por `<img>`, e é essa a razão de existir em vez de a tela
 * injetar o SVG na página: dentro de `<img>` um `<script>` ou um `onload` no
 * SVG não executa. A arte é conteúdo editável pelo admin, então ela chega como
 * dado, e dado não vira marcação.
 *
 * Guarda a `src` que falhou, e não um booleano: o componente não é remontado ao
 * trocar de patente, e um booleano esconderia a arte seguinte por causa do erro
 * da anterior. */

export interface AppIllustrationProps {
  /** Nulo ou vazio não desenha nada. */
  src?: string | null
  /** Vazio de propósito quando o nome já está escrito ao lado. */
  alt?: string
  /** Altura em pixels. A largura acompanha a proporção da arte. */
  height: number
}

export default function AppIllustration({ src, alt = '', height }: AppIllustrationProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) return null

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      onError={() => setFailedSrc(src)}
      sx={{ height, width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
    />
  )
}
