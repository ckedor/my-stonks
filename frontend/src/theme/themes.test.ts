import { describe, expect, it } from 'vitest'
import { fontStacks } from './tokens'
import {
  allThemes,
  buildMuiTheme,
  darkThemes,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  defaultLightPalette,
  defaultShape,
  getThemeById,
  lightThemes,
} from './themes'

/* Os três primeiros casos são sobre a lista de temas; o último é sobre o
   caminho que leva a fonte de título até o MUI. Sem ele, trocar `h1`–`h6`
   por engano passaria despercebido: nenhum outro teste olha tipografia. */

describe('catálogo de temas', () => {
  it('não repete id', () => {
    const ids = allThemes.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('usa só as pilhas de fonte declaradas em fontStacks', () => {
    const stacks = Object.values(fontStacks) as string[]
    for (const t of allThemes) {
      expect(stacks).toContain(t.theme.typography.fontFamily)
      expect(stacks).toContain(t.theme.typography.h6.fontFamily)
    }
  })

  it('mantém o preview coerente com o modo do tema', () => {
    for (const t of allThemes) {
      expect(t.theme.palette.mode).toBe(t.mode)
    }
  })
})

describe('buildMuiTheme', () => {
  it('aplica headingFontFamily em h1–h6 e mantém o corpo em fontFamily', () => {
    const theme = buildMuiTheme(defaultLightPalette, {
      ...defaultShape,
      fontFamily: fontStacks.figtree,
      headingFontFamily: fontStacks.newsreader,
    })

    expect(theme.typography.fontFamily).toBe(fontStacks.figtree)
    expect(theme.typography.body1.fontFamily).toBe(fontStacks.figtree)
    for (const variant of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const) {
      expect(theme.typography[variant].fontFamily).toBe(fontStacks.newsreader)
    }
  })
})

/* O app escolhe o tema de abertura por id, e um `DEFAULT_*_THEME_ID` apontando
   para nada não quebra build nem lint: a tela abre no tema errado, ou em
   nenhum. É o tipo de erro que só aparece rodando. */
describe('temas padrão', () => {
  it('o padrão claro existe e está entre os claros', () => {
    const theme = getThemeById(DEFAULT_LIGHT_THEME_ID)
    expect(theme, DEFAULT_LIGHT_THEME_ID).toBeDefined()
    expect(lightThemes).toContain(theme)
  })

  it('o padrão escuro existe e está entre os escuros', () => {
    const theme = getThemeById(DEFAULT_DARK_THEME_ID)
    expect(theme, DEFAULT_DARK_THEME_ID).toBeDefined()
    expect(darkThemes).toContain(theme)
  })
})

/* Contraste do texto sobre o card. A régua é a do WCAG para texto normal
   (4.5:1) no `text.primary` e a de texto grande / elemento de interface (3:1)
   no `text.secondary`, que aqui só aparece em rótulo e legenda.

   `topbar-contrast.test.ts` faz o mesmo pela barra. Faltava a página: um tema
   novo com secundário bonito e ilegível entrava calado no catálogo. */
function relativeLuminance(color: string): number {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  const channels = [0, 2, 4].map((i) => {
    const value = parseInt(full.slice(i, i + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)]
  const [lighter, darker] = x > y ? [x, y] : [y, x]
  return (lighter + 0.05) / (darker + 0.05)
}

describe('legibilidade do texto sobre o card', () => {
  /* Prova que a régua reprova de verdade: sem este caso, um erro no cálculo
     aprovaria todo tema e o teste viraria enfeite. */
  it('reprova cinza claro sobre papel branco', () => {
    expect(contrastRatio('#BBBBBB', '#FFFFFF')).toBeLessThan(3)
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })

  for (const { id, theme } of allThemes) {
    it(id, () => {
      const paper = theme.palette.background.paper
      expect(contrastRatio(theme.palette.text.primary, paper)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(theme.palette.text.secondary, paper)).toBeGreaterThanOrEqual(3)
    })
  }
})
