import { describe, expect, it } from 'vitest'
import { fontStacks } from './tokens'
import { allThemes, buildMuiTheme, defaultLightPalette, defaultShape } from './themes'

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
