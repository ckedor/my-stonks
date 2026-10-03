import { Box, ThemeProvider } from '@mui/material'
import { useMemo, type ReactNode } from 'react'
import { buildMuiTheme, type ThemePaletteConfig, type ThemeShapeConfig } from '@/theme/themes'

/* Um pedaço de tela pintado por outro tema que não o do app.
 *
 * Existe para o estúdio de temas: o que está sendo montado ainda não é o tema
 * em uso, e a única forma honesta de mostrar como ele fica é desenhar a tela
 * de verdade sob ele. O estúdio põe a moldura inteira aqui dentro — barra,
 * coluna, fundo e o painel de controles —, então tudo o que se vê é o tema em
 * edição, e não um recorte dele emoldurado pelo tema de fora.
 *
 * Pinta fundo, cor e fonte do próprio bloco: fora de uma moldura, o que está
 * aqui dentro herdaria os do `body`, que são do tema do app. */

export interface AppThemeScopeProps {
  palette: ThemePaletteConfig
  /** Fontes, raio e superfícies quietas. Sem ela, a forma padrão dos tokens:
   *  um tema é paleta e forma, e testar só a cor esconde metade dele. */
  shape?: ThemeShapeConfig
  children: ReactNode
}

export default function AppThemeScope({ palette, shape, children }: AppThemeScopeProps) {
  // Montar um tema do MUI custa; só refaz quando a paleta ou a forma mudam.
  const theme = useMemo(() => buildMuiTheme(palette, shape), [palette, shape])

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          bgcolor: 'background.default',
          color: 'text.primary',
          fontFamily: theme.typography.fontFamily,
        }}
      >
        {children}
      </Box>
    </ThemeProvider>
  )
}
