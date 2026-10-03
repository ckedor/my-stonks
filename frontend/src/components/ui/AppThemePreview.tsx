import { Box, Typography } from '@mui/material'
import type { Theme } from '@mui/material/styles'
import { navRailBackground, type ThemePreview } from '@/theme/themes'
import { useAppTheme } from './useAppTheme'

/* Miniatura do app pintada com as cores de um tema.
 *
 * É desenho puro e não sabe nada de carteira: recebe sete cores e devolve a
 * barra, a lateral e quatro cartões em escala. Mora no design system porque é
 * o app se representando — se a moldura das telas mudar, muda aqui junto, num
 * lugar só.
 *
 * As medidas são percentuais para a miniatura acompanhar a largura da célula
 * em que estiver, mantendo a proporção 16/9. */

const NAV_LINES = [0, 1, 2]

export interface AppThemePreviewProps {
  colors: ThemePreview
  sampleTheme?: Theme
}

export default function AppThemePreview({ colors, sampleTheme }: AppThemePreviewProps) {
  const theme = useAppTheme()

  if (sampleTheme) {
    const palette = sampleTheme.palette
    const font = sampleTheme.typography.fontFamily
    return (
      <Box
        aria-hidden="true"
        sx={{
          width: '100%',
          aspectRatio: '16 / 10',
          bgcolor: palette.background.default,
          border: `1px solid ${palette.divider}`,
          borderRadius: `${sampleTheme.radius.sm}px`,
          overflow: 'hidden',
          fontFamily: font,
        }}
      >
        <Box
          sx={{
            height: '14%',
            px: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: palette.topbar.background,
            color: palette.topbar.text,
            borderBottom: `1px solid ${palette.divider}`,
          }}
        >
          <Typography sx={{ fontFamily: font, fontSize: 8, fontWeight: 700 }}>MY STONKS</Typography>
          <Box sx={{ width: 16, height: 2, bgcolor: palette.primary.main, ml: 'auto' }} />
        </Box>
        <Box sx={{ display: 'flex', height: '86%' }}>
          <Box sx={{ width: '16%', bgcolor: navRailBackground(palette), px: 0.75, py: 1.5 }}>
            {NAV_LINES.map((i) => (
              <Box
                key={i}
                sx={{
                  height: 3,
                  mb: 1,
                  width: i === 1 ? '65%' : '90%',
                  bgcolor: palette.topbar.text,
                  opacity: i === 0 ? 0.7 : 0.2,
                  borderRadius: `${sampleTheme.radius.sm}px`,
                }}
              />
            ))}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, p: 1 }}>
            <Typography
              sx={{
                fontFamily: sampleTheme.typography.h5.fontFamily,
                color: palette.text.primary,
                fontSize: 17,
                lineHeight: 1.3,
                fontWeight: 600,
                mb: 0.5,
              }}
            >
              Visão geral
            </Typography>
            <Box
              sx={{
                bgcolor: palette.background.paper,
                border: `1px solid ${palette.divider}`,
                borderRadius: `${sampleTheme.radius.sm}px`,
                p: 0.75,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 0.5,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: font,
                    fontSize: 13,
                    fontWeight: 600,
                    color: palette.text.primary,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  124.380,00
                </Typography>
                <Typography sx={{ fontFamily: font, fontSize: 9, color: palette.success.main }}>
                  +4,2%
                </Typography>
              </Box>
              <Box
                component="svg"
                viewBox="0 0 200 40"
                preserveAspectRatio="none"
                sx={{ display: 'block', width: '100%', height: 35 }}
              >
                <path
                  d="M0 34 L18 31 L35 32 L54 23 L73 27 L91 17 L111 20 L133 10 L153 13 L175 7 L200 4"
                  fill="none"
                  stroke={palette.primary.main}
                  strokeWidth="2"
                />
                <path
                  d="M0 36 L25 34 L50 33 L75 31 L100 29 L125 28 L150 26 L175 24 L200 22"
                  fill="none"
                  stroke={palette.secondary.main}
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        width: '100%',
        aspectRatio: '16 / 9',
        bgcolor: colors.background,
        borderRadius: `${theme.radius.sm}px`,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Barra superior */}
      <Box
        sx={{
          height: '14%',
          bgcolor: colors.topbar,
          display: 'flex',
          alignItems: 'center',
          px: 0.75,
          gap: 0.5,
        }}
      >
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: colors.primary }} />
        <Box sx={{ width: 16, height: 2.5, borderRadius: 1, bgcolor: colors.text, opacity: 0.4 }} />
      </Box>

      <Box sx={{ display: 'flex', height: '86%', p: 0.5, gap: 0.4 }}>
        {/* Barra lateral */}
        <Box sx={{ width: '18%', bgcolor: colors.sidebar, borderRadius: 0.5, p: 0.4 }}>
          {NAV_LINES.map((i) => (
            <Box
              key={i}
              sx={{
                width: '70%',
                height: 2.5,
                bgcolor: colors.text,
                opacity: 0.2,
                mb: 0.4,
                borderRadius: 0.5,
              }}
            />
          ))}
        </Box>

        {/* Cartões de conteúdo */}
        <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.4 }}>
          {[colors.primary, colors.accent, colors.text, colors.primary].map((color, i) => (
            <Box key={i} sx={{ bgcolor: colors.paper, borderRadius: 0.5, p: 0.4 }}>
              <Box
                sx={{
                  width: '50%',
                  height: 2.5,
                  bgcolor: color,
                  opacity: i > 1 ? 0.2 : 0.7,
                  borderRadius: 0.5,
                }}
              />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
