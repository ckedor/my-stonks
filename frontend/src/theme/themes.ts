import { createTheme, getContrastRatio, type Theme } from '@mui/material/styles';
import { fontFamily, fontStacks, radius, space, type RadiusScale } from './tokens';
import { earthStudies } from './earth-studies';

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
   Sépia Noturno — o `Principal` depois do anoitecer
   ══════════════════════════════════════════════

   A mesma régua de neutros quentes do `Principal` claro, virada do avesso: o
   off-white #FAF8F4 vira um quase-preto que ainda puxa para o marrom, e o
   grafite #403B36 da barra desce para #100E0D. A barra continuar sendo a
   coisa mais escura da tela é o ponto do desenho — é o que dá a leitura de
   moldura em volta do conteúdo, e é justamente o que se perde num escuro
   onde barra e página têm a mesma luminância.

   O card é #211E1B, um degrau acima do fundo: como no claro, é a diferença
   entre papel e página que separa um card do outro sem precisar de borda
   forte.

   A âmbar #B45309 do claro não sobrevive sobre fundo escuro (3.0:1), então
   o acento sobe para #E0913F. A primária é o inverso da de lá: no claro é
   tinta escura sobre papel, aqui é areia clara que preenche o botão e
   recebe texto escuro por cima. */
const sepiaNoturnoPalette: ThemePaletteConfig = {
  mode: 'dark',
  background: { default: '#171513', paper: '#211E1B' },
  text: { primary: '#EDE8E2', secondary: '#A69E95' },
  primary: '#D6CFC7',
  secondary: '#E0913F',
  error: '#F27171',
  warning: '#E9A23B',
  success: '#34D3A4',
  info: '#7FB2E5',
  golden: '#F0B44A',
  dark: '#171513',
  sidebar: '#100E0D',
  topbar: { background: '#100E0D', text: '#D9D2CA', activeText: '#FFFFFF', activeBg: '#2A2622' },
  divider: 'rgba(237,232,226,0.12)',
  chart: {
    grid: 'rgba(237,232,226,0.10)',
    label: '#EDE8E2',
    /* Nenhuma repete `primary` nem `secondary`: no gráfico de rentabilidade
       essas duas já estão em uso fixo (Carteira e CDI) e o resto das séries
       vem daqui por índice. O ouro é oliváceo (#B9A44E) e não dourado, senão
       encostaria na âmbar do acento. Todas passam de 4.5:1 sobre o card. */
    colors: ['#C88A6A', '#DE7A72', '#A3C1AD', '#9CAFB7', '#C4696D', '#A8886A', '#8FB8C9', '#B9A44E'],
  },
}

/** Raio pequeno: papel não tem canto arredondado. */
const sepiaRadius: RadiusScale = { sm: 4, md: 6, lg: 6, pill: 9999 }

/* A dupla que mais se aproxima da tipografia do site do Claude sem depender
   de fonte licenciada: Newsreader no lugar da Tiempos/Copernicus, Figtree no
   lugar da Styrene. */
const claudeShape: ThemeShapeConfig = {
  radius: sepiaRadius,
  fontFamily: fontStacks.figtree,
  headingFontFamily: fontStacks.newsreader,
}

const sepiaChartColors = [
  '#4E6E4A', '#9E3B2E', '#A98146', '#5C6B7A',
  '#7A5C6E', '#3F6B6B', '#8C6A4F', '#B08C3A',
]

const editorialSepiaPalette: ThemePaletteConfig = {
  mode: 'light',
  background: { default: '#F4EDE2', paper: '#FBF6EE' },
  text: { primary: '#2B241C', secondary: '#6B5D4C' },
  primary: '#A65336',
  secondary: '#87644E',
  error: '#9E3B2E',
  warning: '#9A6516',
  success: '#4E6E4A',
  info: '#4A6076',
  golden: '#B08C3A',
  dark: '#2B241C',
  sidebar: '#3A2E23',
  topbar: { background: '#3A2E23', text: '#F1E7D9', activeText: '#FBF6EE', activeBg: '#55432F' },
  divider: 'rgba(43,36,28,0.14)',
  chart: { grid: 'rgba(43,36,28,0.10)', label: '#2B241C', colors: sepiaChartColors },
}

/* Mesma tinta, papel um tom mais claro no `paper`: a Newsreader tem traço
   mais fino que a Source Serif e some um pouco sobre bege fechado. */
const sepiaClaudePalette: ThemePaletteConfig = {
  ...editorialSepiaPalette,
  background: { default: '#F4EDE2', paper: '#FCF8F1' },
  text: { primary: '#291F17', secondary: '#6E6053' },
  dark: '#291F17',
  divider: 'rgba(41,31,23,0.14)',
  chart: { grid: 'rgba(41,31,23,0.10)', label: '#291F17', colors: sepiaChartColors },
}

/* ══════════════════════════════════════════════
   Névoa e Marinho — os dois claros frios
   ══════════════════════════════════════════════

   O catálogo claro tinha três temas e uma temperatura só: Argila, Tinta e
   Sépia Claude são todos papel quente com acento de terra, e escolher entre
   eles é escolher a fonte do título, não a cara da tela. O escuro tem sete e
   varia bem mais que isso. Estes dois abrem o lado frio, e se dividem pelo
   que a barra faz — que é a decisão que mais muda a tela:

   - `Névoa` não tem barra escura. Barra, coluna e página são a mesma
     superfície clara, separadas por um fio; a tela vira uma folha só e o
     conteúdo é o único bloco de tinta. É o oposto do Tinta.
   - `Marinho` faz o contrário: um azul quase preto emoldura o conteúdo, como
     o preto do Tinta, mas frio e com cobre no lugar da terracota.

   Nenhum dos dois repete `primary` ou `secondary` nas séries de gráfico: no
   gráfico de rentabilidade essas duas já estão em uso fixo (Carteira e CDI). */
const nevoaPalette: ThemePaletteConfig = {
  mode: 'light',
  background: { default: '#F1F4F7', paper: '#FCFDFE' },
  text: { primary: '#1B2430', secondary: '#5B6875' },
  primary: '#1F5468',
  secondary: '#A2643C',
  error: '#B03A34',
  warning: '#96631A',
  success: '#2F7A55',
  info: '#35617D',
  golden: '#A8801F',
  dark: '#1B2430',
  /* Barra clara: `getContrastText` é quem escolhe a tinta dela, e já servia
     ao Argila claro — nenhum componente precisou saber deste caso. */
  sidebar: '#E6EBF0',
  topbar: { background: '#E6EBF0', text: '#35414E', activeText: '#16202B', activeBg: '#CFD8E1' },
  divider: 'rgba(27,36,48,0.12)',
  chart: {
    grid: 'rgba(27,36,48,0.10)',
    label: '#1B2430',
    colors: ['#2E6B8A', '#C2703F', '#4F7A57', '#7C6BA0', '#A64F5E', '#3F8C93', '#8A7B4F', '#5A6B7C'],
  },
}

const nevoaShape: ThemeShapeConfig = {
  radius: { sm: 6, md: 10, lg: 10, pill: 9999 },
  fontFamily: fontStacks.figtree,
  headingFontFamily: fontStacks.figtree,
  quiet: true,
}

const marinhoPalette: ThemePaletteConfig = {
  mode: 'light',
  background: { default: '#F3F5F8', paper: '#FFFFFF' },
  text: { primary: '#16202C', secondary: '#58657A' },
  primary: '#1B3A5C',
  secondary: '#A05F2C',
  error: '#B23A34',
  warning: '#9A6516',
  success: '#2C7A52',
  info: '#2F6389',
  golden: '#A8801F',
  dark: '#16202C',
  sidebar: '#142A42',
  topbar: { background: '#142A42', text: '#C6D3E2', activeText: '#FFFFFF', activeBg: '#23415F' },
  divider: 'rgba(22,32,44,0.12)',
  chart: {
    grid: 'rgba(22,32,44,0.10)',
    label: '#16202C',
    colors: ['#2C5F8A', '#C0703C', '#47806C', '#8E5F87', '#A8515A', '#5E7387', '#9A7A3C', '#3E6E4E'],
  },
}

/** Canto quase reto e grotesca nos dois papéis: é a tela de painel, não a de
 *  leitura — a serifa e o raio macio ficam com os temas editoriais. */
const marinhoShape: ThemeShapeConfig = {
  radius: { sm: 2, md: 4, lg: 4, pill: 9999 },
  fontFamily: fontStacks.grotesk,
  headingFontFamily: fontStacks.grotesk,
  quiet: true,
}

const earthThemeDefinitions: ThemeDefinition[] = earthStudies.map((study) => ({
  id: study.id,
  name: study.name,
  description: study.description,
  mode: study.palette.mode,
  preview: buildPreview(study.palette),
  theme: buildMuiTheme(study.palette, study.shape),
}))

export const lightThemes: ThemeDefinition[] = [
  ...earthThemeDefinitions.filter((theme) => theme.mode === 'light'),
  {
    id: 'sepia-claude',
    name: 'Sépia Claude',
    mode: 'light',
    description: 'Papel creme, títulos serifados e detalhes em laranja queimado',
    preview: buildPreview(sepiaClaudePalette),
    theme: buildMuiTheme(sepiaClaudePalette, claudeShape),
  },
  {
    id: 'nevoa',
    name: 'Névoa',
    mode: 'light',
    description: 'Neutros frios sem barra escura: a tela inteira é uma superfície só.',
    preview: buildPreview(nevoaPalette),
    theme: buildMuiTheme(nevoaPalette, nevoaShape),
  },
  {
    id: 'marinho',
    name: 'Marinho',
    mode: 'light',
    description: 'Papel frio emoldurado por azul quase preto, com acento de cobre.',
    preview: buildPreview(marinhoPalette),
    theme: buildMuiTheme(marinhoPalette, marinhoShape),
  },
]

export const darkThemes: ThemeDefinition[] = [
  ...earthThemeDefinitions.filter((theme) => theme.mode === 'dark'),
  /* O preview mostra o texto da barra, não o `text.primary` da página —
     mesma razão do `Principal` claro. */
  {
    id: 'sepia-noturno',
    name: 'Sépia Noturno',
    mode: 'dark',
    description: 'Quase-preto quente com barra grafite e acento âmbar',
    preview: {
      background: '#171513',
      paper: '#211E1B',
      primary: '#D6CFC7',
      accent: '#E0913F',
      topbar: '#100E0D',
      sidebar: '#100E0D',
      text: '#D9D2CA',
    },
    theme: buildMuiTheme(sepiaNoturnoPalette),
  },
]

/* ══════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════ */

export const allThemes = [...lightThemes, ...darkThemes]

export function getThemeById(id: string): ThemeDefinition | undefined {
  return allThemes.find((t) => t.id === id)
}

export const DEFAULT_LIGHT_THEME_ID = 'earth-tinta-light'
export const DEFAULT_DARK_THEME_ID = 'sepia-noturno'
