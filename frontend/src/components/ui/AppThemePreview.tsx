import { Box } from '@mui/material'
import type { ThemePreview } from '@/theme/themes'
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
}

export default function AppThemePreview({ colors }: AppThemePreviewProps) {
  const theme = useAppTheme()

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
