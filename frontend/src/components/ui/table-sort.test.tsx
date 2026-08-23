import { ThemeProvider } from '@mui/material/styles'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildMuiTheme, defaultLightPalette } from '@/theme/themes'
import AppSimpleTable, { type AppSimpleTableColumn } from './AppSimpleTable'

/* A ordenação da `AppSimpleTable` é o que sustenta a tabela de trades: a
   coluna que ordena, a que não ordena de propósito, e o valor ausente que vai
   para o fim em vez de disputar o topo. */

const theme = buildMuiTheme(defaultLightPalette)

interface Row {
  id: number
  ticker: string
  lucro: number | null
  acumulado: number
}

const ROWS: Row[] = [
  { id: 1, ticker: 'PETR4', lucro: 300, acumulado: 10 },
  { id: 2, ticker: 'BOVA11', lucro: null, acumulado: 30 },
  { id: 3, ticker: 'HGLG11', lucro: -50, acumulado: 20 },
]

const COLUMNS: AppSimpleTableColumn<Row>[] = [
  { label: 'Ativo', sortValue: (row) => row.ticker, render: (row) => row.ticker },
  { label: 'Lucro', sortValue: (row) => row.lucro, render: (row) => String(row.lucro) },
  { label: 'Acumulado', render: (row) => String(row.acumulado) },
]

const renderTable = (props: Partial<React.ComponentProps<typeof AppSimpleTable<Row>>> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <AppSimpleTable rows={ROWS} columns={COLUMNS} getRowKey={(row) => row.id} {...props} />
    </ThemeProvider>,
  )

/** Os tickers na ordem em que a tabela os desenhou. */
const tickers = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelectorAll('td')[0].textContent)

describe('AppSimpleTable — ordenação', () => {
  it('mostra as linhas na ordem recebida quando não há ordenação', () => {
    renderTable()

    expect(tickers()).toEqual(['PETR4', 'BOVA11', 'HGLG11'])
  })

  it('começa pela coluna e pelo sentido de `defaultSort`', () => {
    renderTable({ defaultSort: { column: 'Ativo', direction: 'desc' } })

    expect(tickers()).toEqual(['PETR4', 'HGLG11', 'BOVA11'])
  })

  it('inverte o sentido ao clicar de novo no mesmo cabeçalho', () => {
    renderTable({ defaultSort: { column: 'Ativo', direction: 'desc' } })

    fireEvent.click(screen.getByRole('button', { name: 'Ativo' }))

    expect(tickers()).toEqual(['BOVA11', 'HGLG11', 'PETR4'])
  })

  /* O traço da compra não realiza lucro: ordenado como zero, ele se
     intercalaria com o prejuízo de verdade. */
  it('joga o valor ausente para o fim nos dois sentidos', () => {
    renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Lucro' }))
    expect(tickers()).toEqual(['HGLG11', 'PETR4', 'BOVA11'])

    fireEvent.click(screen.getByRole('button', { name: 'Lucro' }))
    expect(tickers()).toEqual(['PETR4', 'HGLG11', 'BOVA11'])
  })

  /* A coluna sem `sortValue` não ordena, e é o que impede que um acumulado
     por ativo vire ranking da carteira inteira. */
  it('não torna clicável a coluna sem `sortValue`', () => {
    renderTable()

    expect(screen.queryByRole('button', { name: 'Acumulado' })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Acumulado' })).toBeInTheDocument()
  })

  it('pagina sem desmontar a altura reservada da tabela', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      ticker: `FII${String(index + 1).padStart(2, '0')}`,
      lucro: index,
      acumulado: index,
    }))
    renderTable({ rows, pageSize: 10, fixedHeight: 620 })

    expect(tickers()).toHaveLength(10)
    expect(screen.getByText('1-10 de 12')).toBeInTheDocument()
    expect(screen.getByRole('table').parentElement).toHaveStyle({ height: '620px' })

    fireEvent.click(screen.getByRole('button', { name: /next page/i }))
    expect(tickers()).toHaveLength(2)
    expect(screen.getByText('11-12 de 12')).toBeInTheDocument()
    expect(screen.getByRole('table').parentElement).toHaveStyle({ height: '620px' })
  })
})
