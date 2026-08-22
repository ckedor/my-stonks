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
/** Pilha de fontes do app — fonte única de verdade.
 *
 * Precisa ser uma string literal, e não `var(--alguma-coisa)`: os gráficos
 * de candle repassam `theme.typography.fontFamily` para o lightweight-charts,
 * que desenha em canvas, e canvas não resolve custom property de CSS.
 *
 * `src/index.css` repete a pilha para a pintura anterior ao mount do React.
 * As duas precisam continuar iguais. */
export const fontFamily =
  `'Hanken Grotesk Variable', 'Hanken Grotesk', 'Helvetica Neue', Arial, sans-serif`

/** As outras pilhas, pelo mesmo motivo: um tema escolhe uma delas em
 *  `ThemeShapeConfig` e nenhuma outra parte do app escreve nome de fonte.
 *
 *  Cada uma corresponde a um pacote `@fontsource-variable/*` importado em
 *  `src/main.tsx` — sem o import, a pilha cai silenciosamente no fallback,
 *  que é exatamente o tipo de erro que só aparece na tela. */
export const fontStacks = {
  /** A do app: rótulo, tabela, botão. */
  grotesk: fontFamily,
  /** Serifa de texto, alto contraste — títulos dos temas Sépia. */
  sourceSerif: `'Source Serif 4 Variable', 'Source Serif 4', Georgia, serif`,
  /** Serifa de leitura, olho maior — títulos dos temas “Claude”. */
  newsreader: `'Newsreader Variable', Newsreader, Georgia, serif`,
  /** Grotesca geométrica que acompanha a Newsreader no corpo. */
  figtree: `'Figtree Variable', Figtree, 'Helvetica Neue', Arial, sans-serif`,
} as const

/* A escala é um *valor de tema*, não uma constante global: o tema Pixel Art
   zera todos os raios. Estes são os valores do tema padrão — quem quiser
   outros passa a própria escala para `buildMuiTheme`. */
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

/** O formato da escala, para um tema declarar a sua. */
export type RadiusScale = Record<RadiusToken, number>

/** Espaçamentos, em unidades de `theme.spacing` (1 = 8px). */
export const space = {
  none: 0,
  xs: 0.5,
  sm: 1,
  md: 2,
  lg: 3,
  /** Separa blocos que são assuntos diferentes na mesma faixa. */
  xl: 4,
  /** O maior da escala: alinha uma coluna lateral com o conteúdo de um
   *  desenho que reserva uma faixa no próprio topo. */
  xxl: 5,
} as const

export type SpaceToken = keyof typeof space

/* ──────────────────────────────────────────────
   Module augmentation — expõe os tokens no theme
   ────────────────────────────────────────────── */
declare module '@mui/material/styles' {
  interface Theme {
    radius: RadiusScale
    space: typeof space
  }
  interface ThemeOptions {
    radius?: RadiusScale
    space?: typeof space
  }
}
