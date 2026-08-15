import { createContext, useContext } from 'react'
import { DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID } from './themes'

/* Contexto e hook do modo de tema.
 *
 * Moram fora do `index.tsx` porque o Fast Refresh do Vite só funciona em
 * arquivos que exportam apenas componentes: exportar o hook ao lado do
 * `ThemeRegistry` derruba o hot reload do provider inteiro. */

export type ThemeMode = 'light' | 'dark'

export interface ThemeModeContextValue {
  mode: ThemeMode
  toggleTheme: () => void
  lightThemeId: string
  darkThemeId: string
  setLightTheme: (id: string) => void
  setDarkTheme: (id: string) => void
}

export const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'dark',
  toggleTheme: () => {},
  lightThemeId: DEFAULT_LIGHT_THEME_ID,
  darkThemeId: DEFAULT_DARK_THEME_ID,
  setLightTheme: () => {},
  setDarkTheme: () => {},
})

export const useThemeMode = () => useContext(ThemeModeContext)
