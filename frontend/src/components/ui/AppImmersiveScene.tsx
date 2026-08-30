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
 *  sobre fotografia.
 *
 *  A legibilidade sai do bloco, e não do cenário: escurecer a arte inteira
 *  para conseguir ler é apagar a única coisa que a tela veio mostrar. O texto
 *  vive num cartão translúcido, do tamanho do que ele diz — o vidro fosco
 *  segura a letra e a paisagem continua vendo-se através dele. Sem sombra na
 *  letra: sobre o cartão ela vira borrão, e é o cartão que faz o contraste. */
export function AppImmersiveCaption({ children }: AppImmersiveCaptionProps) {
  const theme = useAppTheme()

  return (
    <Box
      sx={{
        width: { xs: '100%', sm: 380 },
        textAlign: { xs: 'left', sm: 'right' },
        p: 2,
        borderRadius: `${theme.radius.md}px`,
        backgroundColor: withOpacity('#000000', 0.26),
        backdropFilter: 'blur(10px)',
        border: `1px solid ${withOpacity('#ffffff', 0.12)}`,
        boxShadow: `0 18px 48px ${withOpacity('#000000', 0.45)}`,
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
              /* Bloqueado ainda é a cena, só que fora de foco: o borrão é de
                 teaser — dá para ver que há um lugar ali e não o que ele é —, e
                 a saturação baixa mais o leve escurecimento sustentam o texto
                 por cima. */
              filter: locked ? 'grayscale(0.25) brightness(0.7) blur(12px)' : 'none',
              transform: locked ? 'scale(1.06)' : 'scale(1.01)',
              transition: 'filter 320ms ease, transform 320ms ease',
            }}
          />
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
