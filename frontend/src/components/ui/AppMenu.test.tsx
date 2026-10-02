import { ThemeProvider } from '@mui/material/styles'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildMuiTheme, defaultLightPalette } from '@/theme/themes'
import AppMenu, { type AppMenuOption } from './AppMenu'

/* O `MenuList` decide quem recebe o foco ao abrir lendo `selected` e
   `disabled` nos próprios filhos. Com cada item embrulhado num `Fragment`
   (para a régua de `separatorBefore`), ele só via o embrulho: o foco caía no
   painel, e o console acusava o `Fragment` em toda tela com menu. */

const theme = buildMuiTheme(defaultLightPalette)

const renderMenu = (options: AppMenuOption[]) =>
  render(
    <ThemeProvider theme={theme}>
      <AppMenu id="menu-teste" anchorEl={document.body} open onClose={() => undefined} options={options} />
    </ThemeProvider>,
  )

afterEach(() => vi.restoreAllMocks())

describe('AppMenu', () => {
  it('abre com o foco no item selecionado, mesmo depois de uma régua', () => {
    renderMenu([
      { label: 'Principal' },
      { label: 'Reserva', selected: true },
      { label: 'Nova carteira', separatorBefore: true },
    ])

    expect(screen.getByRole('menuitem', { name: 'Reserva' })).toHaveFocus()
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  it('pula o item desabilitado quando nenhum está selecionado', () => {
    renderMenu([{ label: 'e2e@my-stonks.test', disabled: true }, { label: 'Logout', separatorBefore: true }])

    expect(screen.getByRole('menuitem', { name: 'Logout' })).toHaveFocus()
  })

  it('não entrega Fragment ao Menu', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    renderMenu([{ label: 'Configurações' }, { label: 'Sair', separatorBefore: true }])

    expect(error.mock.calls.flat().join('\n')).not.toMatch(/Fragment/)
  })
})
