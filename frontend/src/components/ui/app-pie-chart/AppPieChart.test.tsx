import { cloneElement } from 'react'
import { render } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { describe, expect, it, vi } from 'vitest'
import AppPieChart from './AppPieChart'

vi.mock('recharts', async (orig) => {
  const mod = await orig<typeof import('recharts')>()
  return {
    ...mod,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 400, height: 300 }}>
        {cloneElement(children, { width: 400, height: 300 })}
      </div>
    ),
  }
})

const theme = createTheme()
;(theme as any).palette.chart = { colors: ['#a00', '#0a0', '#00a'] }
;(theme as any).palette.dark = '#000'

const data = [
  { label: 'A', value: 50 },
  { label: 'B', value: 30 },
  { label: 'C', value: 20 },
]

describe('AppPieChart hiddenLabels', () => {
  it('desenha sem a fatia escondida e mantém a porcentagem do total', () => {
    const { container } = render(
      <ThemeProvider theme={theme}>
        <AppPieChart data={data} height={300} hiddenLabels={['C']} />
      </ThemeProvider>,
    )
    expect(container.textContent).toContain('50.0%')
    expect(container.textContent).not.toContain('C')
  })

  it('sobrevive a esconder depois de desenhada', () => {
    const tree = (hidden: string[]) => (
      <ThemeProvider theme={theme}>
        <AppPieChart data={data} height={300} hiddenLabels={hidden} />
      </ThemeProvider>
    )
    const { container, rerender } = render(tree([]))
    expect(container.textContent).toContain('C')
    rerender(tree(['C']))
    expect(container.textContent).toContain('50.0%')
    rerender(tree([]))
    expect(container.textContent).toContain('C')
  })
})
