import { describe, expect, it } from 'vitest'

import {
  formatDuration,
  formatRelative,
  formatWhen,
  ROUTINE_PAGES,
} from './integrations/operationsFormat'
import {
  adminNavigationSections,
  getAdminNavigationSection,
  INTEGRATIONS_PATH,
} from './navigation'

const integrations = () =>
  adminNavigationSections.find((section) => section.id === 'integrations')!

describe('admin navigation', () => {
  /* O painel leva a cada rotina pelo mapa ROUTINE_PAGES, e o menu leva pelos
     itens de Integrações. Se os dois se separam, ou o painel aponta para uma
     tela que o menu não mostra, ou o menu mostra uma tela de sincronização
     que o painel não acompanha — e o "tudo num lugar só" deixa de ser. */
  it('lists in the menu every routine screen the dashboard links to', () => {
    const menu = new Set(integrations().items.map((item) => item.path))
    const linked = Object.values(ROUTINE_PAGES).filter(
      (path): path is string => path !== null && path.startsWith(INTEGRATIONS_PATH),
    )

    expect(linked.filter((path) => !menu.has(path))).toEqual([])
  })

  it('has no integration screen outside the routine catalog', () => {
    const monitoring = [INTEGRATIONS_PATH, `${INTEGRATIONS_PATH}/runs`]
    const routinePages = new Set(Object.values(ROUTINE_PAGES))

    expect(
      integrations()
        .items.map((item) => item.path)
        .filter((path) => !monitoring.includes(path) && !routinePages.has(path)),
    ).toEqual([])
  })

  it('opens on the integrations dashboard and keeps its routines in the section', () => {
    expect(adminNavigationSections[0].defaultPath).toBe(INTEGRATIONS_PATH)
    expect(getAdminNavigationSection(`${INTEGRATIONS_PATH}/etf-registry`).id).toBe(
      'integrations',
    )
  })
})

describe('operations formatting', () => {
  const now = new Date('2026-09-23T15:50:00Z') // 12:50 em Brasília

  it('reads times in the worker zone, as the schedule states them', () => {
    expect(formatWhen('2026-09-23T16:00:00Z', now)).toBe('hoje 13:00')
    expect(formatWhen('2026-09-24T08:00:00Z', now)).toBe('amanhã 05:00')
    expect(formatWhen('2026-09-22T12:00:00Z', now)).toBe('ontem 09:00')
  })

  it('says how long ago and how long it took', () => {
    expect(formatRelative('2026-09-23T15:30:00Z', now)).toBe('há 20 min')
    expect(formatRelative('2026-09-23T18:50:00Z', now)).toBe('em 3 h')
    expect(formatDuration(0.2)).toBe('< 1 s')
    expect(formatDuration(95)).toBe('1 min 35 s')
  })
})
