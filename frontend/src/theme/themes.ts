import { createTheme, type Theme } from '@mui/material/styles';
import { fontFamily, radius, space } from './tokens';

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

const lightComponents = {
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
        borderRadius: radius.lg,
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
}

const darkComponents = {
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
        borderRadius: radius.lg,
        textTransform: 'none' as const,
      },
    },
  },
  ...toggleComponents,
  ...overlayComponents,
}

const baseTypography = {
  fontFamily,
  h5: { fontWeight: 600, letterSpacing: '-0.01em' },
  h6: { fontWeight: 600, letterSpacing: '-0.01em' },
  subtitle2: { fontWeight: 600, letterSpacing: '0.02em' },
  body1: { lineHeight: 1.6 },
  body2: { lineHeight: 1.5 },
}

/* ──────────────────────────────────────────────
   Theme factory — builds a MUI Theme from config
   ──────────────────────────────────────────────

   Todo tema do app passa por aqui, inclusive os customizados do usuário.
   É o único lugar que injeta `radius` e `space`, então nenhum tema pode
   existir sem os tokens do design system. */
export function buildMuiTheme(config: ThemePaletteConfig): Theme {
  const isLight = config.mode === 'light'
  return createTheme({
    palette: {
      mode: config.mode,
      background: config.background,
      text: config.text,
      primary: { main: config.primary },
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
    components: isLight ? lightComponents : darkComponents,
    typography: baseTypography,
    radius,
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

/* O azul-acinzentado que era o `Grafite Neutro`, mantido ao lado do
   `Principal`: mesma estrutura (papel branco, header escuro), régua de
   neutros fria em vez de quente. */
const slateNeutralPalette: ThemePaletteConfig = {
  mode: 'light',
  background: { default: '#F3F4F6', paper: '#FFFFFF' },
  text: { primary: '#111827', secondary: '#6B7280' },
  primary: '#374151',
  secondary: '#6366F1',
  error: '#DC2626',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#3B82F6',
  golden: '#F59E0B',
  dark: '#111827',
  sidebar: '#1F2937',
  topbar: { background: '#2b3848', text: '#F3F4F6', activeText: '#FFFFFF', activeBg: '#374151' },
  divider: 'rgba(17,24,39,0.10)',
  chart: {
    grid: 'rgba(17,24,39,0.10)',
    label: '#111827',
    /* Série do escuro antigo, que nasceu para o fundo #303030. A terceira era
       #FFF5E1 — creme, 1.08:1 sobre o branco do paper, ou seja invisível. No
       lugar dela vai o oposto do papel que ela cumpria lá: era o neutro claro
       sobre fundo escuro, aqui é o neutro escuro sobre fundo claro (6.1:1), e
       a luminosidade separa ela de todas as outras. A última, #FFD700, saiu
       pelo mesmo motivo (1.4:1) e virou ouro velho. */
    colors: ['#D2A679', '#D15F57', '#7A5C43', '#A3C1AD', '#AB4E52', '#a3c1bd', '#9CAFB7', '#B8860B'],
  },
}

/* ══════════════════════════════════════════════
   LIGHT THEMES
   ══════════════════════════════════════════════ */

export const lightThemes: ThemeDefinition[] = [
  /* ── 1. Principal ─────────────────────────── */
  /* O preview não sai de `buildPreview`: ele mostra o texto do topbar (claro
     sobre o header escuro), não o `text.primary` da página. */
  {
    id: 'principal-light',
    name: 'Principal',
    mode: 'light',
    description: 'Off-white quente com header grafite, sóbrio e sem azul',
    preview: {
      background: '#FAF8F4',
      paper: '#FFFFFF',
      primary: '#44403C',
      accent: '#B45309',
      topbar: '#403B36',
      sidebar: '#403B36',
      text: '#EFEBE7',
    },
    theme: buildMuiTheme(defaultLightPalette),
  },

  /* ── 2. Grafite Neutro ────────────────────── */
  {
    id: 'slate-neutral',
    name: 'Grafite Neutro',
    mode: 'light',
    description: 'Header cinza escuro azulado, clean e versátil',
    preview: {
      background: '#F3F4F6',
      paper: '#FFFFFF',
      primary: '#374151',
      accent: '#6366F1',
      topbar: '#2b3848',
      sidebar: '#1F2937',
      text: '#F3F4F6',
    },
    theme: buildMuiTheme(slateNeutralPalette),
  },
]

/* ══════════════════════════════════════════════
   DARK THEMES
   ══════════════════════════════════════════════ */

export const darkThemes: ThemeDefinition[] = [
  /* ── 1. Principal ─────────────────────────── */
  {
    id: 'principal-dark',
    name: 'Principal',
    mode: 'dark',
    description: 'Escuro neutro no estilo do VS Code Dark',
    preview: buildPreview(defaultDarkPalette),
    theme: buildMuiTheme(defaultDarkPalette),
  },
]

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

export const allThemes = [...lightThemes, ...darkThemes]

export function getThemeById(id: string): ThemeDefinition | undefined {
  return allThemes.find((t) => t.id === id)
}

export const DEFAULT_LIGHT_THEME_ID = 'principal-light'
export const DEFAULT_DARK_THEME_ID = 'principal-dark'
