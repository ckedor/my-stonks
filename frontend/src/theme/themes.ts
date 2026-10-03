import { createTheme, getContrastRatio, type Theme } from '@mui/material/styles';
import { fontFamily, radius, space, type RadiusScale } from './tokens';
import { THEME_PRESETS, type ThemePreset } from './presets';

/* ──────────────────────────────────────────────
   Module augmentation (single source of truth)
   ────────────────────────────────────────────── */
declare module '@mui/material/styles' {
  interface Palette {
    dark: string
    chart: { grid: string; label: string; colors: string[] }
    golden: string
    topbar: { background: string; text: string; activeText: string; activeBg: string }
  }
  interface PaletteOptions {
    dark?: string
    chart?: { grid?: string; label?: string; colors?: string[] }
    golden?: string
    topbar?: { background?: string; text?: string; activeText?: string; activeBg?: string }
  }
}

/* ──────────────────────────────────────────────
   Public types
   ────────────────────────────────────────────── */
export interface ThemePreview {
  background: string
  paper: string
  primary: string
  accent: string
  topbar: string
  sidebar: string
  text: string
}

export interface ThemeDefinition {
  id: string
  name: string
  mode: 'light' | 'dark'
  description: string
  preview: ThemePreview
  theme: Theme
}

/* ──────────────────────────────────────────────
   Forma e tipografia — a parte do tema que não é cor
   ──────────────────────────────────────────────

   Tipografia e geometria complementam a paleta. Os valores de tokens.ts
   são usados quando o tema não especifica sua própria forma. */
export interface ThemeShapeConfig {
  /** Flat surfaces and restrained controls. */
  quiet?: boolean
  radius: RadiusScale
  /** Corpo: rótulo, tabela, botão — e o que o candle chart repassa para o
   *  canvas do lightweight-charts. */
  fontFamily: string
  /** Títulos (`h1`–`h6`). Nos temas de par serifa + grotesca é a serifa; nos
   *  demais repete `fontFamily`. Sempre explícita: um tema que herdasse a
   *  fonte de título de outro lugar é um tema que muda sozinho quando aquele
   *  outro lugar mudar. */
  headingFontFamily: string
}

export const defaultShape: ThemeShapeConfig = {
  radius,
  fontFamily,
  headingFontFamily: fontFamily,
}

/** As cores de um tema, como um preset as escreve (`presets.ts`). */
export interface ThemePaletteConfig {
  mode: 'light' | 'dark'
  background: { default: string; paper: string }
  text: { primary: string; secondary: string }
  primary: string
  secondary: string
  error: string
  warning: string
  success: string
  info: string
  golden: string
  dark: string
  topbar: { background: string; text: string; activeText: string; activeBg: string }
  divider: string
  chart: { grid: string; label: string; colors: string[] }
}

/* ──────────────────────────────────────────────
   Shared component overrides
   ────────────────────────────────────────────── */
/* Opening a select or menu made MUI lock body scroll and compensate the
   scrollbar with `padding-right`, which showed up as a gap along the right
   edge of the app. Declared once here so no component has to remember
   `disableScrollLock`. Dialogs and drawers keep the lock: for a real modal,
   freezing the page behind it is the wanted behaviour. */
const overlayComponents = {
  MuiPopover: { defaultProps: { disableScrollLock: true } },
  MuiMenu: { defaultProps: { disableScrollLock: true } },
}

/* O `MuiButton` já desliga o CAIXA ALTA do MUI, mas o `ToggleButton` é um
   componente à parte e ficou de fora: "RENT. ACUMULADA" ao lado de "Nova
   Operação" na mesma tela. Um rótulo é escrito uma vez e lido do mesmo
   jeito em qualquer botão. */
const toggleComponents = {
  MuiToggleButton: {
    styleOverrides: {
      root: {
        textTransform: 'none' as const,
      },
    },
  },
}

const lightComponents = (shape: ThemeShapeConfig) => ({
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        border: 'none',
        boxShadow: 'none',
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0px 2px 10px rgba(0,0,0,0.06)',
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: shape.radius.lg,
        textTransform: 'none' as const,
      },
      containedPrimary: {
        boxShadow: 'none',
        '&:hover': { boxShadow: '0px 4px 12px rgba(0,0,0,0.14)' },
      },
    },
  },
  ...toggleComponents,
  ...overlayComponents,
})

const darkComponents = (shape: ThemeShapeConfig) => ({
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        border: 'none',
        boxShadow: 'none',
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        border: '1px solid rgba(255,255,255,0.06)',
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: shape.radius.lg,
        textTransform: 'none' as const,
      },
    },
  },
  ...toggleComponents,
  ...overlayComponents,
})

const baseTypography = (shape: ThemeShapeConfig) => ({
  fontFamily: shape.fontFamily,
  h1: { fontFamily: shape.headingFontFamily },
  h2: { fontFamily: shape.headingFontFamily },
  h3: { fontFamily: shape.headingFontFamily },
  h4: { fontFamily: shape.headingFontFamily },
  h5: { fontFamily: shape.headingFontFamily, fontWeight: 600, letterSpacing: '-0.01em' },
  h6: { fontFamily: shape.headingFontFamily, fontWeight: 600, letterSpacing: '-0.01em' },
  subtitle2: { fontWeight: 600, letterSpacing: '0.02em' },
  body1: { lineHeight: 1.6 },
  body2: { lineHeight: 1.5 },
})

/* ──────────────────────────────────────────────
   Theme factory — builds a MUI Theme from config
   ──────────────────────────────────────────────

   Todo tema do app passa por aqui, inclusive o que o estúdio de temas está
   montando. É o único lugar que injeta `radius` e `space`, então nenhum tema pode
   existir sem os tokens do design system. */
export function buildMuiTheme(
  config: ThemePaletteConfig,
  shape: ThemeShapeConfig = defaultShape,
): Theme {
  const isLight = config.mode === 'light'
  return createTheme({
    palette: {
      mode: config.mode,
      background: config.background,
      text: config.text,
      primary: { main: config.primary, ...(shape.quiet ? { contrastText: getContrastRatio(config.primary, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#171614' } : {}) },
      secondary: { main: config.secondary },
      error: { main: config.error },
      warning: { main: config.warning },
      success: { main: config.success },
      info: { main: config.info },
      golden: config.golden,
      dark: config.dark,
      topbar: config.topbar,
      divider: config.divider,
      chart: config.chart,
    },
    components: {
      ...(isLight ? lightComponents(shape) : darkComponents(shape)),
      ...(shape.quiet ? {
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', boxShadow: 'none', border: `1px solid ${config.divider}` } } },
        MuiButton: { styleOverrides: {
          root: { borderRadius: shape.radius.lg, textTransform: 'none' as const, fontWeight: 600, boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
        } },
        MuiOutlinedInput: { styleOverrides: { root: { borderRadius: shape.radius.sm, '& .MuiOutlinedInput-notchedOutline': { borderColor: config.divider } } } },
        MuiCssBaseline: { styleOverrides: { body: { fontVariantNumeric: 'tabular-nums' } } },
      } : {}),
    },
    typography: baseTypography(shape),
    radius: shape.radius,
    space,
  })
}

/** Onde a coluna de navegação é pintada. Nos temas claros ela veste a barra
 *  do topo; nos escuros acompanha a página — o porquê está no `AppNavRail`,
 *  que a desenha a partir daqui. A miniatura do tema lê o mesmo, para não
 *  pintar uma coluna que a tela de verdade não tem. */
export function navRailBackground(
  palette: Pick<ThemePaletteConfig, 'mode'> & {
    background: { default: string }
    topbar: { background: string }
  },
): string {
  return palette.mode === 'light' ? palette.topbar.background : palette.background.default
}

/** Extracts a ThemePreview from a palette config */
export function buildPreview(config: ThemePaletteConfig): ThemePreview {
  return {
    background: config.background.default,
    paper: config.background.paper,
    primary: config.primary,
    accent: config.secondary,
    topbar: config.topbar.background,
    sidebar: navRailBackground(config),
    text: config.text.primary,
  }
}

/* ══════════════════════════════════════════════
   O catálogo — cada preset vira um tema do MUI
   ══════════════════════════════════════════════ */

const presetThemes: ThemeDefinition[] = THEME_PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.name,
  description: preset.description,
  mode: preset.palette.mode,
  preview: buildPreview(preset.palette),
  theme: buildMuiTheme(preset.palette, preset.shape),
}))

export const lightThemes: ThemeDefinition[] = presetThemes.filter((theme) => theme.mode === 'light')

export const darkThemes: ThemeDefinition[] = presetThemes.filter((theme) => theme.mode === 'dark')

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

export const allThemes = [...lightThemes, ...darkThemes]

export function getThemeById(id: string): ThemeDefinition | undefined {
  return allThemes.find((t) => t.id === id)
}

/** O preset por trás de um tema: paleta e forma, como estão escritas. */
export function getPresetById(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((preset) => preset.id === id)
}

export const DEFAULT_LIGHT_THEME_ID = 'earth-tinta-light'
export const DEFAULT_DARK_THEME_ID = 'petroleo'
