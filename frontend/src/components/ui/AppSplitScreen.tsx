import { Box } from '@mui/material'
import type { ReactNode } from 'react'

/* Tela dividida: imagem de um lado, conteúdo centrado do outro.
 *
 * A imagem some no mobile em vez de encolher — 45% de uma tela estreita não
 * é ilustração, é uma faixa que rouba metade do formulário. */

const IMAGE_WIDTH = '45%'
const CONTENT_MAX_WIDTH = 480

export interface AppSplitScreenProps {
  /** Caminho da imagem do lado esquerdo. */
  imageUrl: string
  children: ReactNode
}

export default function AppSplitScreen({ imageUrl, children }: AppSplitScreenProps) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          width: IMAGE_WIDTH,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      <Box
        sx={{
          flex: 1,
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
