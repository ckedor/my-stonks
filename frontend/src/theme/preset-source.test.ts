import { describe, expect, it } from 'vitest'
import { presetSource } from './preset-source'
import { THEME_PRESETS } from './presets'
import { fontStacks } from './tokens'

/* O estúdio de temas exporta um preset como texto para colar em `presets.ts`.
   Se o texto perder um campo, ou escrever uma fonte por extenso em vez de
   `fontStacks.x`, o tema colado não é o tema que se montou — e nada avisa até
   alguém abrir a tela. Aqui cada preset do catálogo vira texto e o texto volta
   a ser preset, avaliado com `fontStacks` em escopo como em `presets.ts`. */

const evaluate = (source: string) =>
  new Function('fontStacks', `return (${source})`)(fontStacks) as unknown

describe('presetSource', () => {
  for (const preset of THEME_PRESETS) {
    it(`devolve ${preset.id} igual`, () => {
      expect(evaluate(presetSource(preset))).toEqual(preset)
    })
  }

  it('escreve a fonte como referência a fontStacks, não por extenso', () => {
    const source = presetSource(THEME_PRESETS[0])
    expect(source).toMatch(/fontFamily: fontStacks\.\w+,/)
    expect(source).not.toContain(THEME_PRESETS[0].shape.fontFamily)
  })

  it('protege aspas e barras do nome e da descrição', () => {
    const preset = { ...THEME_PRESETS[0], name: "D'Ávila \\ teste", description: "it's" }
    expect(evaluate(presetSource(preset))).toEqual(preset)
  })
})
