import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { TOPBAR_HEIGHT } from './AppTopbar'
import { useAppTheme, withOpacity } from './useAppTheme'

/* Cena que ocupa a janela por trás do conteúdo.
 *
 * A imagem fica presa sob a barra superior, recebe a máscara que sustenta o
 * texto e pode esconder a arte ainda bloqueada. A página só fornece conteúdo:
 * posição, camadas e tratamento responsivo pertencem a este primitivo. */

export interface AppImmersiveSceneProps {
  /** Imagem que cobre a janela. Ausente ainda preserva a camada de conteúdo. */
  src?: string
  /** Descrição usada quando a cena bloqueada é conteúdo, não decoração. */
  alt?: string
  /** Esconde os detalhes da imagem e desenha a interrogação central. */
  locked?: boolean
  children: ReactNode
}

export interface AppImmersiveCaptionProps {
  children: ReactNode
}

/** Legenda sobre uma cena: largura de leitura no desktop, alinhamento que
 *  acompanha a tela estreita e sombra suficiente para continuar legível
 *  sobre fotografia. */
export function AppImmersiveCaption({ children }: AppImmersiveCaptionProps) {
  return (
    <Box
      sx={{
        width: { xs: '100%', sm: 380 },
        textAlign: { xs: 'left', sm: 'right' },
        textShadow: `0 4px 24px ${withOpacity('#000000', 0.85)}`,
      }}
    >
      {children}
    </Box>
  )
}

export default function AppImmersiveScene({
  src,
  alt = '',
  locked = false,
  children,
}: AppImmersiveSceneProps) {
  const theme = useAppTheme()

  return (
    <>
      <Box
        aria-hidden={locked ? undefined : true}
        sx={{
          position: 'fixed',
          top: `${TOPBAR_HEIGHT}px`,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          overflow: 'hidden',
        }}
      >
        {src && (
          <Box
            component="img"
            src={src}
            alt={alt}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: locked ? 'grayscale(1) brightness(0.22) blur(18px)' : 'none',
              transform: locked ? 'scale(1.08)' : 'scale(1.01)',
              transition: 'filter 320ms ease, transform 320ms ease',
            }}
          />
        )}

        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, ${withOpacity(
              theme.palette.background.default,
              0.72,
            )} 0%, ${withOpacity(theme.palette.background.default, 0.1)} 28%, ${withOpacity(
              '#000000',
              0.3,
            )} 62%, ${withOpacity('#000000', 0.88)} 100%)`,
          }}
        />

        {locked && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: withOpacity(theme.palette.golden, 0.7),
            }}
          >
            <Box sx={{ fontSize: { xs: 96, md: 180 }, fontWeight: 900, lineHeight: 1 }}>?</Box>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: `calc(100vh - ${TOPBAR_HEIGHT}px - 120px)`,
        }}
      >
        {children}
      </Box>
    </>
  )
}
