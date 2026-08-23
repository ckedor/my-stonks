import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

import { buildMuiTheme, defaultLightPalette } from './themes'

/* O tema de teste tem que sair de `buildMuiTheme`: `createTheme()` puro não
   carrega `radius` nem `space`, que são valores de tema, e qualquer primitivo
   do design system quebra ao lê-los. Mora em `src/theme/` porque é a camada
   autorizada a importar o MUI — assim nenhum teste precisa entrar no
   `eslint-ds-baseline.json` só para montar um ThemeProvider. */
export const renderWithTheme = (ui: ReactElement) =>
  render(<ThemeProvider theme={buildMuiTheme(defaultLightPalette)}>{ui}</ThemeProvider>)
