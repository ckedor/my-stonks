import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ThemeRegistry } from '@/theme'
import PortfolioStandingCard from './PortfolioStandingCard'

/* O cabeçalho da carteira: o patrimônio no tamanho de título e o CAGR com a
   comparação ao CDI embaixo. A patente saiu dele. */

const format = (value: number) => `R$ ${value.toLocaleString('pt-BR')}`

function renderCard(cagr: number | null, cdiPct: number | null = 185) {
  return render(
    <ThemeRegistry>
      <PortfolioStandingCard
        patrimony={219_018.63}
        cagr={cagr}
        cdiPct={cdiPct}
        formatCurrency={format}
      />
    </ThemeRegistry>,
  )
}

describe('PortfolioStandingCard', () => {
  it('mostra o patrimônio e o CAGR contra o CDI', () => {
    renderCard(24.03)

    expect(screen.getByText('Patrimônio')).toBeInTheDocument()
    expect(screen.getByText('R$ 219.018,63')).toBeInTheDocument()
    expect(screen.getByText(/CAGR \+24\.03%/)).toBeInTheDocument()
    expect(screen.getByText('(185% do CDI)')).toBeInTheDocument()
  })

  it('não mostra patente', () => {
    renderCard(24.03)

    expect(screen.queryByText(/Próximo/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Faltam/)).not.toBeInTheDocument()
  })

  it('mostra o patrimônio mesmo sem série para o CAGR', () => {
    renderCard(null)

    expect(screen.getByText('R$ 219.018,63')).toBeInTheDocument()
    expect(screen.queryByText(/CAGR/)).not.toBeInTheDocument()
  })
})
