import { styled, type Theme } from '@mui/material/styles'
import { space, type SpaceToken } from '@/theme/tokens'

/* ──────────────────────────────────────────────
   AppGrid — grade responsiva em CSS Grid
   ──────────────────────────────────────────────

   Substitui o `<Grid>` do MUI. A diferença de modelo importa: no MUI cada
   filho declara quanto ocupa (`size={{ xs: 12, md: 6 }}`, repetido em todo
   filho); aqui o pai declara quantas colunas existem (`cols={{ xs: 1, md: 2 }}`)
   e os filhos só fluem. É menos repetição e descreve melhor a intenção.

   O levantamento do código mostrou que a maioria das grades é justamente
   "N colunas iguais, empilhadas no mobile" — coberto por `cols`. Os poucos
   layouts assimétricos que existem (`md: 8` + `md: 4`, `lg: 5` + `lg: 7`)
   são cobertos por `AppGridItem span`. */

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg'
type Responsive = number | Partial<Record<Breakpoint, number>>

const UP: Exclude<Breakpoint, 'xs'>[] = ['sm', 'md', 'lg']

function normalize(value: Responsive): Partial<Record<Breakpoint, number>> {
  return typeof value === 'number' ? { xs: value } : value
}

/** Monta as regras por breakpoint; `xs` é a base, os outros entram em media queries. */
function responsiveRules(
  theme: Theme,
  value: Responsive,
  toCss: (n: number) => Record<string, string>,
) {
  const byBreakpoint = normalize(value)
  return {
    ...(byBreakpoint.xs != null ? toCss(byBreakpoint.xs) : null),
    ...Object.fromEntries(
      UP.filter((bp) => byBreakpoint[bp] != null).map((bp) => [
        theme.breakpoints.up(bp),
        toCss(byBreakpoint[bp] as number),
      ]),
    ),
  }
}

const columnsCss = (n: number) => ({ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` })
const spanCss = (n: number) => ({ gridColumn: `span ${n} / span ${n}` })

export interface AppGridProps {
  /** Número de colunas, fixo ou por breakpoint. Padrão: 1. */
  cols?: Responsive
  /** Espaço entre as células. Padrão: `none`, igual ao Grid do MUI. */
  gap?: SpaceToken
  /** Alinhamento vertical das células. */
  align?: 'start' | 'center' | 'stretch'
}

const GRID_STYLE_PROPS = new Set(['cols', 'gap', 'align'])

const AppGrid = styled('div', {
  shouldForwardProp: (prop) => !GRID_STYLE_PROPS.has(prop as string),
})<AppGridProps>(({ theme, cols = 1, gap = 'none', align }) => ({
  display: 'grid',
  gap: theme.spacing(space[gap]),
  ...responsiveRules(theme, cols, columnsCss),
  ...(align ? { alignItems: align } : null),
}))

export interface AppGridItemProps {
  /** Quantas colunas a célula ocupa, fixo ou por breakpoint. Padrão: 1. */
  span?: Responsive
}

const ITEM_STYLE_PROPS = new Set(['span'])

export const AppGridItem = styled('div', {
  shouldForwardProp: (prop) => !ITEM_STYLE_PROPS.has(prop as string),
})<AppGridItemProps>(({ theme, span = 1 }) => ({
  minWidth: 0,
  ...responsiveRules(theme, span, spanCss),
}))

export default AppGrid
