import { Box, useMediaQuery } from '@mui/material'
import type { ReactNode } from 'react'

/* Tela dividida: vídeo de um lado, conteúdo centrado do outro.
 *
 * O vídeo fica com o que sobra; a coluna do conteúdo tem 40% da tela, mas
 * nunca menos que o formulário mais o respiro dos lados.
 *
 * O vídeo some no mobile em vez de encolher — 60% de uma tela estreita não
 * é ilustração, é uma faixa que rouba metade do formulário.
 *
 * Quem pede menos movimento ao sistema vê só o pôster. `noSsr` faz a
 * consulta responder já no primeiro render: sem ele ela começa `false`, o
 * vídeo sai tocando, e tirar o `autoPlay` depois não o para. */

const CONTENT_WIDTH = '40%'
const CONTENT_MAX_WIDTH = 480
const CONTENT_MIN_WIDTH = CONTENT_MAX_WIDTH + 48

export interface AppSplitScreenProps {
  /** Vídeo do lado esquerdo, sem som e em loop. */
  videoUrl: string
  /** Quadro parado: aparece enquanto o vídeo carrega e no lugar dele quando
   *  o sistema pede menos movimento. */
  posterUrl: string
  children: ReactNode
}

export default function AppSplitScreen({ videoUrl, posterUrl, children }: AppSplitScreenProps) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true })

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        <Box
          component="video"
          src={videoUrl}
          poster={posterUrl}
          autoPlay={!reduceMotion}
          loop
          muted
          playsInline
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // A gravação é mais larga que o painel; o corte sai da direita,
            // e o menu lateral fica sempre à vista.
            objectPosition: 'left top',
          }}
        />
      </Box>

      <Box
        sx={{
          flex: { xs: 1, md: `0 0 ${CONTENT_WIDTH}` },
          minWidth: { md: CONTENT_MIN_WIDTH },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          px: 3,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>{children}</Box>
      </Box>
    </Box>
  )
}
