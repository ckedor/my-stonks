/* ──────────────────────────────────────────────
   Design tokens
   ──────────────────────────────────────────────

   Valores de forma e espaçamento que os componentes do design system
   (`src/components/ui/`) consomem. Nasceram de um levantamento do código
   existente, não de uma escala inventada: cada valor aqui já era usado em
   algum lugar, então introduzi-los não muda nada visualmente.

   `shape.borderRadius` do MUI continua no default (4). Ele NÃO é o lugar
   certo para essa escala: em `sx`, `borderRadius: 2` significa
   `shape.borderRadius * 2`, então mexer ali deslocaria todos os raios já
   escritos nas páginas. Estes tokens são absolutos em px e independentes
   daquele multiplicador.
   ────────────────────────────────────────────── */

/** Raios de canto, em px. */
export const radius = {
  /** Chips, inputs e elementos pequenos. */
  sm: 6,
  /** Cards e superfícies — o raio padrão do app. */
  md: 8,
  /** Botões. */
  lg: 10,
  /** Totalmente arredondado. */
  pill: 9999,
} as const

export type RadiusToken = keyof typeof radius

/** Espaçamentos, em unidades de `theme.spacing` (1 = 8px). */
export const space = {
  none: 0,
  xs: 0.5,
  sm: 1,
  md: 2,
  lg: 3,
} as const

export type SpaceToken = keyof typeof space

/* ──────────────────────────────────────────────
   Module augmentation — expõe os tokens no theme
   ────────────────────────────────────────────── */
declare module '@mui/material/styles' {
  interface Theme {
    radius: typeof radius
    space: typeof space
  }
  interface ThemeOptions {
    radius?: typeof radius
    space?: typeof space
  }
}
