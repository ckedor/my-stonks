import { Box } from '@mui/material'
import { useState } from 'react'
import { radius } from '@/theme/tokens'

/* Logotipo pequeno ao lado de um nome.
 *
 * Some sozinho quando a imagem não carrega. Provedor de dados costuma
 * anunciar logo para nome do qual não tem arte, e a URL responde 404 — a
 * própria imagem é o único sinal confiável.
 *
 * Guarda a URL que falhou, e não um booleano: o componente não é remontado
 * ao navegar de um item para outro, e um booleano deixaria o logo do
 * próximo escondido por causa do erro do anterior. */

const SIZE = 28

export interface AppLogoImageProps {
  /** Nulo ou vazio não desenha nada. */
  src?: string | null
  /** Vazio de propósito quando o nome já está escrito ao lado: repetir o
   *  nome no `alt` faz o leitor de tela dizer tudo duas vezes. */
  alt?: string
}

export default function AppLogoImage({ src, alt = '' }: AppLogoImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) return null

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      onError={() => setFailedSrc(src)}
      sx={{ width: SIZE, height: SIZE, borderRadius: `${radius.sm}px`, objectFit: 'contain' }}
    />
  )
}
