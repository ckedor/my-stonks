import { Box } from '@mui/material'
import { useState } from 'react'

/* Ilustração decorativa — a arte do personagem de uma patente.
 *
 * Renderiza sempre por `<img>`, e é essa a razão de existir em vez de a tela
 * injetar o SVG na página: dentro de `<img>` um `<script>` ou um `onload` no
 * SVG não executa. A arte é conteúdo editável pelo admin, então ela chega como
 * dado, e dado não vira marcação.
 *
 * `circle` recorta a arte num medalhão, como as bolas de perfil: a moldura é
 * fixa, então a arte para de depender de posicionamento absoluto para não
 * empurrar o resto da tela, e o layout responsivo volta a funcionar.
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
  /** Posição em px dentro do `AppStack anchor` mais próximo, para a arte
   *  ficar por cima do que vem depois sem ocupar espaço no fluxo. Não recebe
   *  clique: ela cobre um pedaço do gráfico e roubaria o cursor do tooltip. */
  pinned?: { left: number; top: number }
  /** Recorta a arte num medalhão redondo de lado `height`, com borda. */
  circle?: boolean
}

export default function AppIllustration({
  src,
  alt = '',
  height,
  pinned,
  circle,
}: AppIllustrationProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) return null

  if (circle) {
    return (
      <Box
        sx={(theme) => ({
          width: height,
          height,
          flexShrink: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          border: `2px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.action.hover,
        })}
      >
        <Box
          component="img"
          src={src}
          alt={alt}
          onError={() => setFailedSrc(src)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            /* Aproxima o enquadramento: o personagem chega desenhado com folga
               em volta, e no medalhão essa folga vira quase tudo. */
            transform: 'scale(1.35)',
          }}
        />
      </Box>
    )
  }

  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      onError={() => setFailedSrc(src)}
      sx={{
        height,
        width: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        ...(pinned
          ? {
              position: 'absolute',
              left: pinned.left,
              top: pinned.top,
              zIndex: 2,
              pointerEvents: 'none',
            }
          : null),
      }}
    />
  )
}
