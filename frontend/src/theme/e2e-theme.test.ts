import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { getThemeById, lightThemes } from './themes'

/* A regressão visual fixa um tema por id no localStorage, e um id que não
 * existe mais não falha em lugar nenhum: `readSavedTheme` troca o
 * desconhecido pelo padrão sem dizer nada, e a suíte segue fotografando —
 * outro tema. Foi o que aconteceu com `principal-light`, que ficou no
 * fixture depois de o tema sair do catálogo; as imagens de referência eram
 * do padrão claro, e nada apontava isso.
 *
 * O teste lê o id do próprio fixture em vez de repeti-lo aqui: uma cópia
 * escrita nos dois lugares volta a divergir no dia em que alguém muda um só. */

const FIXTURE = path.join(process.cwd(), 'e2e/fixtures/app.ts')

function savedLightThemeId(): string {
  const source = readFileSync(FIXTURE, 'utf8')
  const match = source.match(/setItem\('theme-light-id',\s*'([^']+)'\)/)
  if (!match) throw new Error(`nenhum theme-light-id encontrado em ${FIXTURE}`)
  return match[1]
}

describe('tema fixado pela regressão visual', () => {
  it('existe no catálogo e é um tema claro', () => {
    const id = savedLightThemeId()
    const theme = getThemeById(id)

    expect(theme, id).toBeDefined()
    expect(lightThemes).toContain(theme)
  })
})
