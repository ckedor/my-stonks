import { ThemeProvider } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

import { buildMuiTheme, defaultLightPalette } from './themes'

/* O tema de teste tem que sair de `buildMuiTheme`: `createTheme()` puro não
   carrega `radius` nem `space`, que são valores de tema, e qualquer primitivo
   do design system quebra ao lê-los. Mora em `src/theme/` porque é a camada
   autorizada a importar o MUI — assim nenhum teste precisa entrar no
   `eslint-ds-baseline.json` só para montar um ThemeProvider. */
/* Um QueryClient por render, e sem retry: um teste que erra tem de falhar na
   hora, não depois de uma nova tentativa. O cliente é novo a cada chamada
   porque cache compartilhado entre testes vaza resposta de um para o outro. */
export const renderWithTheme = (ui: ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={buildMuiTheme(defaultLightPalette)}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  )
}
