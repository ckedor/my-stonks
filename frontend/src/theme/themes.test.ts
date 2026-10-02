import { describe, expect, it } from 'vitest'
import { contrastRatio, paletteContrastChecks } from './contrast'
import { THEME_PRESETS } from './presets'
import { fontStacks } from './tokens'
import {
  allThemes,
  buildMuiTheme,
  darkThemes,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  defaultShape,
  getPresetById,
  getThemeById,
  lightThemes,
  type ThemePaletteConfig,
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
    const theme = buildMuiTheme(getPresetById(DEFAULT_LIGHT_THEME_ID)!.palette, {
      ...defaultShape,
      fontFamily: fontStacks.figtree,
      headingFontFamily: fontStacks.sourceSerif,
    })

    expect(theme.typography.fontFamily).toBe(fontStacks.figtree)
    expect(theme.typography.body1.fontFamily).toBe(fontStacks.figtree)
    for (const variant of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const) {
      expect(theme.typography[variant].fontFamily).toBe(fontStacks.sourceSerif)
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

/* Contraste de cada preset: texto e sinal sobre o card, e a aba ativa sobre a
   barra. As réguas são as de `paletteContrastChecks` marcadas como
   `enforced` — as mesmas que o estúdio de temas mostra enquanto se edita, de
   modo que o que ele aprova o catálogo aceita. */
describe('contraste de cada preset', () => {
  /* Prova que a régua reprova de verdade: sem este caso, um erro no cálculo
     aprovaria todo tema e o teste viraria enfeite. */
  it('reprova cinza claro sobre papel branco', () => {
    expect(contrastRatio('#BBBBBB', '#FFFFFF')).toBeLessThan(3)
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })

  it('reprova a paleta com a aba ativa da mesma cor da barra', () => {
    const preset = getPresetById(DEFAULT_LIGHT_THEME_ID)!
    const muted = {
      ...preset.palette,
      topbar: { ...preset.palette.topbar, activeText: preset.palette.topbar.background, activeBg: preset.palette.topbar.background },
    }
    expect(failingChecks(muted)).toContain('Aba ativa sobre a barra: 1.00')
  })

  for (const preset of THEME_PRESETS) {
    it(preset.id, () => {
      expect(failingChecks(preset.palette)).toEqual([])
    })
  }
})

function failingChecks(palette: ThemePaletteConfig): string[] {
  return paletteContrastChecks(palette)
    .filter((check) => check.enforced && !(check.ratio != null && check.ratio >= check.min))
    .map((check) => `${check.label}: ${check.ratio?.toFixed(2) ?? 'não medido'}`)
}
