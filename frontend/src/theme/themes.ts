import { createTheme, getContrastRatio, type Theme } from '@mui/material/styles';
import { fontFamily, radius, space, type RadiusScale } from './tokens';
import { THEME_PRESETS } from './presets';

/* ──────────────────────────────────────────────
   Module augmentation (single source of truth)
   ────────────────────────────────────────────── */
declare module '@mui/material/styles' {
  interface Palette {
    dark: string
    chart: { grid: string; label: string; colors: string[] }
    golden: string
    sidebar: string
    topbar: { background: string; text: string; activeText: string; activeBg: string }
  }
  interface PaletteOptions {
    dark?: string
    chart?: { grid?: string; label?: string; colors?: string[] }
    golden?: string
    sidebar?: string
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

/** Raw palette values used to create/edit custom themes */
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
  sidebar: string
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

   Todo tema do app passa por aqui, inclusive os customizados do usuário.
   É o único lugar que injeta `radius` e `space`, então nenhum tema pode
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
      sidebar: config.sidebar,
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

/** Extracts a ThemePreview from a palette config */
export function buildPreview(config: ThemePaletteConfig): ThemePreview {
  return {
    background: config.background.default,
    paper: config.background.paper,
    primary: config.primary,
    accent: config.secondary,
    topbar: config.topbar.background,
    sidebar: config.sidebar,
    text: config.text.primary,
  }
}

/* ══════════════════════════════════════════════
   Default palette configs (base for custom themes)
   ══════════════════════════════════════════════ */

/* O claro nasceu com `background.default` branco, igual ao `paper`: card e
   página encostavam sem nenhuma borda entre eles e a tela virava uma folha
   só. O fundo aqui é off-white — é o que separa o card da página — e quente
   de propósito, porque o cinza de interface puxa para o azul por padrão
   (#F3F4F6) e o azul já é a régua do `Grafite Neutro`, ao lado.
   O resto dos neutros é quente pelo mesmo motivo: fundo quente com header
   azulado brigam, e a identidade se perde na emenda. */
export const defaultLightPalette: ThemePaletteConfig = {
  mode: 'light',
  background: { default: '#FAF8F4', paper: '#FFFFFF' },
  text: { primary: '#1C1917', secondary: '#78716C' },
  primary: '#44403C',
  secondary: '#B45309',
  error: '#DC2626',
  warning: '#D97706',
  success: '#10B981',
  info: '#3B82F6',
  golden: '#F59E0B',
  dark: '#1C1917',
  sidebar: '#403B36',
  topbar: { background: '#403B36', text: '#EFEBE7', activeText: '#FFFFFF', activeBg: '#5A534D' },
  divider: 'rgba(28,25,23,0.10)',
  chart: {
    grid: 'rgba(28,25,23,0.10)',
    label: '#1C1917',
    /* Série herdada de um tema de fundo escuro, então duas cores tiveram de
       trocar de lado ao vir para o papel branco: a terceira era #FFF5E1
       (creme, 1.08:1 — invisível) e a última era #FFD700 (ouro, 1.4:1). Cada
       uma virou o oposto do papel que cumpria lá: o neutro claro sobre fundo
       escuro vira o neutro escuro sobre fundo claro, e o ouro claro vira
       ouro velho (3.9:1). */
    colors: ['#D2A679', '#D15F57', '#7A5C43', '#A3C1AD', '#AB4E52', '#a3c1bd', '#9CAFB7', '#B8860B'],
  },
}

/* Escuro no estilo do VS Code Dark: `#1E1E1E` do editor como fundo,
   `#252526` das laterais como card e `#333333` da activity bar no header.
   As cores de série saem da sintaxe do mesmo tema, o que já garante que
   foram desenhadas para conviver sobre `#1E1E1E`. */
export const defaultDarkPalette: ThemePaletteConfig = {
  mode: 'dark',
  background: { default: '#1E1E1E', paper: '#252526' },
  text: { primary: '#CCCCCC', secondary: '#9D9D9D' },
  primary: '#3794FF',
  secondary: '#4EC9B0',
  error: '#F14C4C',
  warning: '#CCA700',
  success: '#89D185',
  info: '#75BEFF',
  golden: '#DCDCAA',
  dark: '#1E1E1E',
  sidebar: '#252526',
  topbar: { background: '#333333', text: '#CCCCCC', activeText: '#FFFFFF', activeBg: '#37373D' },
  divider: '#3C3C3C',
  chart: {
    grid: 'rgba(255,255,255,0.08)',
    label: '#CCCCCC',
    /* Nenhuma repete `primary` nem `secondary`: no gráfico de rentabilidade
       essas duas já estão em uso fixo (Carteira e CDI) e o resto das séries
       vem daqui por índice. */
    colors: ['#CE9178', '#DCDCAA', '#C586C0', '#9CDCFE', '#B5CEA8', '#D16969', '#4FC1FF', '#569CD6'],
  },
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

export const DEFAULT_LIGHT_THEME_ID = 'earth-tinta-light'
export const DEFAULT_DARK_THEME_ID = 'petroleo'
