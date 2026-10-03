import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyPresetChange, presetBlocks } from './preset-file'
import { presetSource } from './preset-source'
import { THEME_PRESETS, type ThemePreset } from './presets'
import { fontStacks } from './tokens'

/* O estúdio de temas grava em `presets.ts` pelo dev server. Um erro aqui não
   aparece no estúdio: aparece como um arquivo quebrado, ou pior, como um
   preset trocado por outro. Os casos rodam sobre o `presets.ts` de verdade, e
   o resultado é lido de volta — o bloco gravado precisa voltar a ser o
   preset que se mandou gravar. */

const FILE = readFileSync(path.join(process.cwd(), 'src/theme/presets.ts'), 'utf8')

const evaluate = (source: string) =>
  new Function('fontStacks', `return (${source})`)(fontStacks) as unknown

const blockOf = (text: string, id: string) => presetBlocks(text).find((block) => block.id === id)!

const arrayOf = (text: string) =>
  /THEME_PRESETS: ThemePreset\[\] = \[([^\]]*)\]/.exec(text)![1].match(/\w+/g)!

describe('presetBlocks', () => {
  it('acha todo preset da lista, com o id e o modo dele', () => {
    const blocks = presetBlocks(FILE)
    expect(blocks.map((block) => block.id).sort()).toEqual(THEME_PRESETS.map((preset) => preset.id).sort())
    for (const preset of THEME_PRESETS) {
      expect(blockOf(FILE, preset.id).mode).toBe(preset.palette.mode)
    }
  })
})

describe('applyPresetChange — update', () => {
  for (const preset of THEME_PRESETS) {
    it(`reescreve ${preset.id} e só ele, inclusive o nome`, () => {
      const edited: ThemePreset = {
        ...preset,
        name: 'Renomeado',
        description: "Outra descrição, com 'aspas'",
        palette: { ...preset.palette, primary: '#123456' },
      }
      const next = applyPresetChange(FILE, { kind: 'update', id: preset.id, source: presetSource(edited) })

      expect(evaluate(blockOf(next, preset.id).source)).toEqual(edited)
      for (const other of presetBlocks(FILE).filter((block) => block.id !== preset.id)) {
        expect(blockOf(next, other.id).source).toBe(other.source)
      }
      expect(arrayOf(next)).toEqual(arrayOf(FILE))
    })
  }

  it('recusa id que não existe', () => {
    const source = presetSource({ ...THEME_PRESETS[0], id: 'nao-existe' })
    expect(() => applyPresetChange(FILE, { kind: 'update', id: 'nao-existe', source })).toThrow(/0 presets/)
  })

  it('recusa trocar o id de um preset publicado', () => {
    const preset = THEME_PRESETS[0]
    const source = presetSource({ ...preset, id: 'outro-id' })
    expect(() => applyPresetChange(FILE, { kind: 'update', id: preset.id, source })).toThrow(/não muda/)
  })
})

describe('applyPresetChange — add', () => {
  const light = THEME_PRESETS.find((preset) => preset.palette.mode === 'light')!
  const dark = THEME_PRESETS.find((preset) => preset.palette.mode === 'dark')!

  const add = (base: ThemePreset, id: string) =>
    applyPresetChange(FILE, {
      kind: 'add',
      id,
      name: 'Teste',
      mode: base.palette.mode,
      source: presetSource({ ...base, id, name: 'Teste' }),
    })

  it('acrescenta um claro no fim dos claros', () => {
    const next = add(light, 'teste-claro')
    const entries = arrayOf(next)
    const modes = entries.map((entry) => presetBlocks(next).find((block) => block.name === entry)!.mode)

    expect(evaluate(blockOf(next, 'teste-claro').source)).toEqual({ ...light, id: 'teste-claro', name: 'Teste' })
    expect(entries).toContain('testeClaro')
    expect(modes.lastIndexOf('light')).toBe(entries.indexOf('testeClaro'))
    expect(modes.indexOf('dark')).toBe(modes.lastIndexOf('light') + 1)
  })

  it('acrescenta um escuro no fim da lista', () => {
    const next = add(dark, 'teste-escuro')
    expect(arrayOf(next).at(-1)).toBe('testeEscuro')
    expect(presetBlocks(next)).toHaveLength(THEME_PRESETS.length + 1)
  })

  it('recusa id repetido e id fora do formato', () => {
    expect(() => add(light, light.id)).toThrow(/já existe/)
    expect(() => add(light, 'Com Espaço')).toThrow(/inválido/)
  })
})
