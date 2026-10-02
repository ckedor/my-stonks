import { Box, ThemeProvider, Typography } from '@mui/material'
import { useMemo, type ReactNode } from 'react'
import { buildMuiTheme, type ThemePaletteConfig, type ThemeShapeConfig } from '@/theme/themes'
import { space } from '@/theme/tokens'

/* Um pedaço de tela pintado por outro tema que não o do app.
 *
 * Existe para o estúdio de temas: o que está sendo montado ainda não é o tema
 * em uso, e a única forma honesta de mostrar como ele fica é desenhar
 * componentes de verdade sob ele. Dentro daqui, `AppCard`, `AppText` e os
 * demais leem o tema que se está montando — sem que a tela precise repetir
 * cor por cor em cada elemento.
 *
 * Desenha a própria superfície porque a moldura pertence ao tema de dentro:
 * um card do app em volta pintaria a borda com a cor do tema de fora. */

export interface AppThemeScopeProps {
  palette: ThemePaletteConfig
  /** Fontes, raio e superfícies quietas. Sem ela, a forma padrão dos tokens:
   *  um tema é paleta e forma, e testar só a cor esconde metade dele. */
  shape?: ThemeShapeConfig
  /** Faixa superior com o nome do recorte, pintada com as cores de topbar do
   *  tema — que de outro modo não apareceriam em lugar nenhum da amostra. */
  title?: string
  children: ReactNode
}

export default function AppThemeScope({ palette, shape, title, children }: AppThemeScopeProps) {
  // Montar um tema do MUI custa; só refaz quando a paleta ou a forma mudam.
  const theme = useMemo(() => buildMuiTheme(palette, shape), [palette, shape])

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          bgcolor: 'background.default',
          color: 'text.primary',
          fontFamily: theme.typography.fontFamily,
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
