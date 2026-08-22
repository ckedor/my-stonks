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

export const defaultLightPalette: ThemePaletteConfig = {
  mode: 'light',
  background: { default: '#ffffff', paper: '#FFFFFF' },
  text: { primary: '#1A1D23', secondary: '#6B7280' },
  primary: '#7C5832',
  secondary: '#B8860B',
  error: '#DC2626',
  warning: '#D97706',
  success: '#059669',
  info: '#2563EB',
  golden: '#B8860B',
  dark: '#1A1D23',
  sidebar: '#F1F2F5',
  topbar: { background: '#ffffff', text: '#1A1D23', activeText: '#FFFFFF', activeBg: '#7C5832' },
  divider: 'rgba(0, 0, 0, 0.08)',
  chart: {
    grid: 'rgba(0, 0, 0, 0.08)',
    label: '#1A1D23',
    colors: ['#A67C52', '#C4956A', '#7A9B76', '#6E8FAD', '#D4A574', '#8E8E8E', '#B8926A', '#9C7C6C'],
  },
}

export const defaultDarkPalette: ThemePaletteConfig = {
  mode: 'dark',
  background: { default: '#303030', paper: '#3e3e3e' },
  text: { primary: '#bebfc2', secondary: '#B0B4BA' },
  primary: '#e1cfca',
  secondary: '#d1705f',
  error: '#ec786b',
  warning: '#eeb227',
  success: '#61a964',
  info: '#5c9bd1',
  golden: '#eeb227',
  dark: '#3b2f2f',
  sidebar: '#3e3e3e',
  topbar: { background: '#3e3e3e', text: '#bebfc2', activeText: '#FFFFFF', activeBg: '#e1cfca33' },
  divider: 'rgba(255,255,255,0.08)',
  chart: {
    grid: '#645959',
    label: '#bebfc2',
    colors: ['#D2A679', '#D15F57', '#FFF5E1', '#A3C1AD', '#AB4E52', '#a3c1bd', '#9CAFB7', '#FFD700'],
  },
}

/* ══════════════════════════════════════════════
   LIGHT THEMES
   ══════════════════════════════════════════════ */

const cafeCorporatePalette: ThemePaletteConfig = {
  mode: 'light',
  background: { default: '#F5F0EB', paper: '#FFFFFF' },
  text: { primary: '#2C1810', secondary: '#6B5B4F' },
  primary: '#6F4E37',
  secondary: '#D4A76A',
  error: '#C0392B',
  warning: '#D4A76A',
  success: '#5B8C5A',
  info: '#5B7FA5',
  golden: '#D4A76A',
  dark: '#2C1810',
  sidebar: '#3C2A1E',
  topbar: { background: '#3C2A1E', text: '#F5EDE6', activeText: '#FFFFFF', activeBg: '#6F4E37' },
  divider: 'rgba(44,24,16,0.10)',
  chart: {
    grid: 'rgba(44,24,16,0.10)',
    label: '#2C1810',
    colors: ['#C47035', '#4A90A4', '#D4A04A', '#6BAF7B', '#C75B5B', '#8B7DB8', '#D18E6E', '#5B8C9A'],
  },
}

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
    /* Série do `defaultDarkPalette`, que nasceu para o fundo #303030. A
       terceira era #FFF5E1 — creme, 1.08:1 sobre o branco do paper, ou seja
       invisível. No lugar dela vai o oposto do papel que ela cumpria lá: era
       o neutro claro sobre fundo escuro, aqui é o neutro escuro sobre fundo
       claro (6.1:1), e a luminosidade separa ela de todas as outras. */
    colors: ['#D2A679', '#D15F57', '#7A5C43', '#A3C1AD', '#AB4E52', '#a3c1bd', '#9CAFB7', '#FFD700'],
  },
}

const executiveGreenPalette: ThemePaletteConfig = {
  mode: 'light',
  background: { default: '#F2F5F3', paper: '#FFFFFF' },
  text: { primary: '#14332A', secondary: '#4A6356' },
  primary: '#1A4D3E',
  secondary: '#2E8B6D',
  error: '#C94040',
  warning: '#D4A849',
  success: '#2E8B6D',
  info: '#4895EF',
  golden: '#D4A849',
  dark: '#14332A',
  sidebar: '#14332A',
  topbar: { background: '#14332A', text: '#E8F0EC', activeText: '#FFFFFF', activeBg: '#1B5E45' },
  divider: 'rgba(20,51,42,0.10)',
  chart: {
    grid: 'rgba(20,51,42,0.10)',
    label: '#14332A',
    colors: ['#2E8B6D', '#D4A849', '#5B8DD6', '#D16060', '#8B6FB8', '#3DB5A0', '#E09050', '#7CA0B0'],
  },
}

export const lightThemes: ThemeDefinition[] = [
  /* ── 1. Principal ─────────────────────────── */
  {
    id: 'principal-light',
    name: 'Principal',
    mode: 'light',
    description: 'Tema padrão claro com tons quentes e elegantes',
    preview: buildPreview(defaultLightPalette),
    theme: buildMuiTheme(defaultLightPalette),
  },

  /* ── 2. Café Corporate ────────────────────── */
  /* O preview não sai de buildPreview: ele mostra o texto do topbar
     (claro sobre o header escuro), não o text.primary da página. */
  {
    id: 'cafe-corporate',
    name: 'Café Corporate',
    mode: 'light',
    description: 'Marrom quente com header escuro, inspirado em café',
    preview: {
      background: '#F5F0EB',
      paper: '#FFFFFF',
      primary: '#6F4E37',
      accent: '#D4A76A',
      topbar: '#3C2A1E',
      sidebar: '#3C2A1E',
      text: '#FFFAF5',
    },
    theme: buildMuiTheme(cafeCorporatePalette),
  },

  /* ── 3. Grafite Neutro ────────────────────── */
  {
    id: 'slate-neutral',
    name: 'Grafite Neutro',
    mode: 'light',
    description: 'Header cinza escuro, clean e versátil',
    preview: {
      background: '#F3F4F6',
      paper: '#FFFFFF',
      primary: '#374151',
      accent: '#6366F1',
      topbar: '#1F2937',
      sidebar: '#1F2937',
      text: '#F3F4F6',
    },
    theme: buildMuiTheme(slateNeutralPalette),
  },

  /* ── 4. Verde Executivo ───────────────────── */
  {
    id: 'executive-green',
    name: 'Verde Executivo',
    mode: 'light',
    description: 'Header verde escuro, elegante para finanças',
    preview: {
      background: '#F2F5F3',
      paper: '#FFFFFF',
      primary: '#1A4D3E',
      accent: '#D4A849',
      topbar: '#14332A',
      sidebar: '#14332A',
      text: '#E8F0EC',
    },
    theme: buildMuiTheme(executiveGreenPalette),
  },
]

/* ══════════════════════════════════════════════
   DARK THEMES
   ══════════════════════════════════════════════ */

const obsidianPalette: ThemePaletteConfig = {
  mode: 'dark',
  background: { default: '#101010', paper: '#1A1A1A' },
  text: { primary: '#E4E4E7', secondary: '#A1A1AA' },
  primary: '#FAFAFA',
  secondary: '#A78BFA',
  error: '#EF4444',
  warning: '#FBBF24',
  success: '#22C55E',
  info: '#60A5FA',
  golden: '#F59E0B',
  dark: '#0A0A0A',
  sidebar: '#1A1A1A',
  topbar: { background: '#1A1A1A', text: '#E4E4E7', activeText: '#FFFFFF', activeBg: '#333333' },
  divider: 'rgba(255,255,255,0.08)',
  chart: {
    grid: 'rgba(255,255,255,0.10)',
    label: '#E4E4E7',
    colors: ['#A78BFA', '#34D399', '#FBBF24', '#F472B6', '#60A5FA', '#FB923C', '#22D3EE', '#C084FC'],
  },
}

const steelSmokePalette: ThemePaletteConfig = {
  mode: 'dark',
  background: { default: '#18181B', paper: '#27272A' },
  text: { primary: '#E4E4E7', secondary: '#A1A1AA' },
  primary: '#E4E4E7',
  secondary: '#71717A',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#22C55E',
  info: '#3B82F6',
  golden: '#F59E0B',
  dark: '#09090B',
  sidebar: '#27272A',
  topbar: { background: '#27272A', text: '#E4E4E7', activeText: '#FFFFFF', activeBg: '#3F3F46' },
  divider: 'rgba(255,255,255,0.08)',
  chart: {
    grid: 'rgba(161,161,170,0.12)',
    label: '#E4E4E7',
    colors: ['#F59E0B', '#3B82F6', '#22C55E', '#EF4444', '#A78BFA', '#EC4899', '#06B6D4', '#FB923C'],
  },
}

const cafeNoirPalette: ThemePaletteConfig = {
  mode: 'dark',
  background: { default: '#1A1210', paper: '#261C18' },
  text: { primary: '#F5E6D3', secondary: '#C4A882' },
  primary: '#D4A76A',
  secondary: '#A0724E',
  error: '#E57373',
  warning: '#E8A838',
  success: '#81C784',
  info: '#64B5F6',
  golden: '#E8A838',
  dark: '#100C0A',
  sidebar: '#261C18',
  topbar: { background: '#261C18', text: '#F5E6D3', activeText: '#FFFFFF', activeBg: '#3B2E27' },
  divider: 'rgba(255,255,255,0.08)',
  chart: {
    grid: 'rgba(196,168,130,0.12)',
    label: '#F5E6D3',
    colors: ['#D4A76A', '#81C784', '#E57373', '#64B5F6', '#CE93D8', '#FFB74D', '#4DB6AC', '#E8A838'],
  },
}

/* A paleta nasceu de um estudo de sprites em pixel art, e o que veio de lá
   não é só a cor: é a regra de que tudo aqui é marrom de terra ou metal.
   `error` foi o único valor que precisou sair do estudo — o #D1594F original
   dá 3.85:1 sobre o paper, e retorno negativo é texto pequeno. O #DC6A5C
   passa dos 4.5:1 sem sair do terracota.

   `topbar.activeText` também foge do #FFFFFF que os outros temas escuros
   usam: o item ativo tem fundo #D4A76A, claro, então branco sobre ele daria
   1.9:1. O texto do item ativo aqui é o próprio fundo da página. */
const pixelArtPalette: ThemePaletteConfig = {
  mode: 'dark',
  background: { default: '#221A15', paper: '#2C231D' },
  text: { primary: '#EEE3D7', secondary: '#B9A794' },
  primary: '#D4A76A',
  secondary: '#E0B84A',
  error: '#DC6A5C',
  warning: '#E0B84A',
  success: '#7BBE71',
  info: '#78A6C8',
  golden: '#E0B84A',
  dark: '#12100E',
  sidebar: '#1A1410',
  topbar: { background: '#1A1410', text: '#EEE3D7', activeText: '#221A15', activeBg: '#D4A76A' },
  divider: 'rgba(238,227,215,0.12)',
  chart: {
    grid: 'rgba(238,227,215,0.10)',
    label: '#EEE3D7',
    colors: ['#D4A76A', '#78A6C8', '#7BBE71', '#DC6A5C', '#E0B84A', '#B9A794', '#A0724E', '#8FA98C'],
  },
}

export const darkThemes: ThemeDefinition[] = [
  /* ── 1. Principal ─────────────────────────── */
  {
    id: 'principal-dark',
    name: 'Principal',
    mode: 'dark',
    description: 'Tema padrão escuro com tons quentes e acolhedores',
    preview: buildPreview(defaultDarkPalette),
    theme: buildMuiTheme(defaultDarkPalette),
  },

  /* ── 2. Obsidiana ─────────────────────────── */
  {
    id: 'obsidian',
    name: 'Obsidiana',
    mode: 'dark',
    description: 'Preto profundo com visual premium',
    preview: {
      background: '#101010',
      paper: '#1A1A1A',
      primary: '#FAFAFA',
      accent: '#A78BFA',
      topbar: '#1A1A1A',
      sidebar: '#1A1A1A',
      text: '#E4E4E7',
    },
    theme: buildMuiTheme(obsidianPalette),
  },

  /* ── 3. Aço Fumê ──────────────────────────── */
  {
    id: 'steel-smoke',
    name: 'Aço Fumê',
    mode: 'dark',
    description: 'Cinza profundo, industrial e sóbrio',
    preview: {
      background: '#18181B',
      paper: '#27272A',
      primary: '#E4E4E7',
      accent: '#F59E0B',
      topbar: '#27272A',
      sidebar: '#27272A',
      text: '#E4E4E7',
    },
    theme: buildMuiTheme(steelSmokePalette),
  },

  /* ── 4. Café Noir ─────────────────────────── */
  {
    id: 'cafe-noir',
    name: 'Café Noir',
    mode: 'dark',
    description: 'Marrom escuro profundo, acolhedor e quente',
    preview: {
      background: '#1A1210',
      paper: '#261C18',
      primary: '#D4A76A',
      accent: '#E8A838',
      topbar: '#261C18',
      sidebar: '#261C18',
      text: '#F5E6D3',
    },
    theme: buildMuiTheme(cafeNoirPalette),
  },

  /* ── 5. Pixel Art ─────────────────────────── */
  {
    id: 'pixel-art',
    name: 'Pixel Art',
    mode: 'dark',
    description: 'Marrom de caverna com ouro e verde de sprite',
    preview: {
      background: '#221A15',
      paper: '#2C231D',
      primary: '#D4A76A',
      accent: '#E0B84A',
      topbar: '#1A1410',
      sidebar: '#1A1410',
      text: '#EEE3D7',
    },
    theme: buildMuiTheme(pixelArtPalette),
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
