import { Box, ThemeProvider, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { buildMuiTheme, type ThemePaletteConfig } from '@/theme/themes'
import { space } from '@/theme/tokens'

/* Um pedaço de tela pintado por outro tema que não o do app.
 *
 * Existe para o editor de temas: o que está sendo editado ainda não é o tema
 * em uso, e a única forma honesta de mostrar como ele fica é desenhar
 * componentes de verdade sob ele. Dentro daqui, `AppCard`, `AppText` e os
 * demais leem o tema que se está montando — sem que a tela precise repetir
 * cor por cor em cada elemento.
 *
 * Desenha a própria superfície porque a moldura pertence ao tema de dentro:
 * um card do app em volta pintaria a borda com a cor do tema de fora. */

export interface AppThemeScopeProps {
  palette: ThemePaletteConfig
  /** Faixa superior com o nome do recorte, pintada com as cores de topbar do
   *  tema — que de outro modo não apareceriam em lugar nenhum da amostra. */
  title?: string
  children: ReactNode
}

export default function AppThemeScope({ palette, title, children }: AppThemeScopeProps) {
  const theme = buildMuiTheme(palette)

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          bgcolor: 'background.default',
          color: 'text.primary',
          borderRadius: `${theme.radius.md}px`,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        {title && (
          <Box
            sx={{
              bgcolor: palette.topbar.background,
              color: palette.topbar.text,
              px: space.md,
              py: space.xs,
              display: 'flex',
              alignItems: 'center',
              gap: space.sm,
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: palette.primary }} />
            <Typography variant="subtitle2" sx={{ color: palette.topbar.text }}>
              {title}
            </Typography>
          </Box>
        )}
        <Box sx={{ p: space.md }}>{children}</Box>
      </Box>
    </ThemeProvider>
  )
}
