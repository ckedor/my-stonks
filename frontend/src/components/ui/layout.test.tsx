import { ThemeProvider } from '@mui/material/styles'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildMuiTheme, defaultLightPalette } from '@/theme/themes'
import AppGrid, { AppGridItem } from './AppGrid'
import AppStack from './AppStack'

const theme = buildMuiTheme(defaultLightPalette)

const renderWithTheme = (ui: React.ReactNode) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe('AppStack', () => {
  it('traduz os tokens para flexbox', () => {
    const { container } = renderWithTheme(
      <AppStack direction="row" gap="md" align="center" justify="between" wrap>
        <span>a</span>
      </AppStack>,
    )

    expect(container.firstChild).toHaveStyle({
      display: 'flex',
      flexDirection: 'row',
      gap: '16px', // token `md` = 2 unidades de spacing
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    })
  })

  it('empilha sem espaço por padrão', () => {
    const { container } = renderWithTheme(<AppStack><span>a</span></AppStack>)

    expect(container.firstChild).toHaveStyle({ flexDirection: 'column', gap: '0px' })
  })

  /* As props de estilo são vocabulário do design system, não atributos de
     DOM. Se vazarem, o React avisa no console e o HTML fica inválido. */
  it('não vaza as props de estilo para o DOM', () => {
    const { container } = renderWithTheme(
      <AppStack direction="row" gap="md" align="center" grow>
        <span>a</span>
      </AppStack>,
    )
    const el = container.firstChild as HTMLElement

    expect(el.getAttribute('direction')).toBeNull()
    expect(el.getAttribute('gap')).toBeNull()
    expect(el.getAttribute('align')).toBeNull()
    expect(el.getAttribute('grow')).toBeNull()
  })
})

describe('AppGrid', () => {
  it('usa o número de colunas do breakpoint base', () => {
    const { container } = renderWithTheme(
      <AppGrid cols={3} gap="lg">
        <div>a</div>
      </AppGrid>,
    )

    expect(container.firstChild).toHaveStyle({
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '24px',
    })
  })

  it('aceita colunas por breakpoint, com xs como base', () => {
    const { container } = renderWithTheme(
      <AppGrid cols={{ xs: 1, md: 2 }}>
        <div>a</div>
      </AppGrid>,
    )

    expect(container.firstChild).toHaveStyle({ gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' })
  })

  it('faz a célula ocupar várias colunas', () => {
    const { container } = renderWithTheme(
      <AppGrid cols={3}>
        <AppGridItem span={2}>a</AppGridItem>
      </AppGrid>,
    )

    const grid = container.firstElementChild as HTMLElement
    expect(grid.firstElementChild).toHaveStyle({ gridColumn: 'span 2' })
  })
})
