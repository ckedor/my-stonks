import type { ThemePreset } from './presets'
import { fontStacks, type RadiusScale } from './tokens'

/* Um preset escrito como código, para colar em `presets.ts`.
 *
 * É o fim do estúdio de temas: o tema montado lá vira este texto, e o commit
 * que o cola na lista é o que o publica. As fontes saem como referência a
 * `fontStacks` (`fontStacks.figtree`), nunca como o nome escrito — é a regra
 * de `themes.test.ts`, e uma pilha copiada por extenso deixaria de
 * acompanhar a de `tokens.ts`. `preset-source.test.ts` prova que o texto
 * gerado de cada preset volta a ser o mesmo preset. */

const quote = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export type FontStackKey = keyof typeof fontStacks

/** A chave de `fontStacks` cuja pilha é esta. */
export function fontStackKey(stack: string): FontStackKey {
  const key = (Object.keys(fontStacks) as FontStackKey[]).find((candidate) => fontStacks[candidate] === stack)
  if (!key) throw new Error(`pilha de fonte fora de fontStacks: ${stack}`)
  return key
}

function radius(scale: RadiusScale) {
  return `{ sm: ${scale.sm}, md: ${scale.md}, lg: ${scale.lg}, pill: ${scale.pill} }`
}

export function presetSource(preset: ThemePreset): string {
  const { palette, shape } = preset
  const lines = [
    '{',
    `  id: ${quote(preset.id)},`,
    `  name: ${quote(preset.name)},`,
    `  description: ${quote(preset.description)},`,
    '  palette: {',
    `    mode: ${quote(palette.mode)},`,
    `    background: { default: ${quote(palette.background.default)}, paper: ${quote(palette.background.paper)} },`,
    `    text: { primary: ${quote(palette.text.primary)}, secondary: ${quote(palette.text.secondary)} },`,
    `    primary: ${quote(palette.primary)},`,
    `    secondary: ${quote(palette.secondary)},`,
    `    error: ${quote(palette.error)},`,
    `    warning: ${quote(palette.warning)},`,
    `    success: ${quote(palette.success)},`,
    `    info: ${quote(palette.info)},`,
    `    golden: ${quote(palette.golden)},`,
    `    dark: ${quote(palette.dark)},`,
    `    sidebar: ${quote(palette.sidebar)},`,
    `    topbar: { background: ${quote(palette.topbar.background)}, text: ${quote(palette.topbar.text)}, activeText: ${quote(palette.topbar.activeText)}, activeBg: ${quote(palette.topbar.activeBg)} },`,
    `    divider: ${quote(palette.divider)},`,
    '    chart: {',
    `      grid: ${quote(palette.chart.grid)},`,
    `      label: ${quote(palette.chart.label)},`,
    `      colors: [${palette.chart.colors.map(quote).join(', ')}],`,
    '    },',
    '  },',
    '  shape: {',
    `    radius: ${radius(shape.radius)},`,
    `    fontFamily: fontStacks.${fontStackKey(shape.fontFamily)},`,
    `    headingFontFamily: fontStacks.${fontStackKey(shape.headingFontFamily)},`,
    ...(shape.quiet ? ['    quiet: true,'] : []),
    '  },',
    '}',
  ]
  return lines.join('\n')
}
