import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ThemeRegistry } from '@/theme'
import type { PortfolioWealthTier, WealthTier } from '@/types'
import PortfolioStandingCard from './PortfolioStandingCard'

/* O card recebe dois números que respondem perguntas diferentes: o título vem
   do pico do patrimônio, e a distância para o próximo degrau vem do valor de
   hoje. Quem separa os dois é o backend — o que se testa aqui é que o card
   desenha os dois como vieram, sem recalcular nenhum, e que ele não assume um
   tamanho de escala.

   A arte do personagem não é desenhada aqui: ela é sobreposta ao gráfico pela
   página, e quem guarda o "sempre `<img>`, nunca marcação injetada" é o teste
   do `AppIllustration`. */

const format = (value: number) => `R$ ${value.toLocaleString('pt-BR')}`

const tier = (rank: number, name: string, threshold: number): WealthTier => ({
  id: rank,
  rank,
  name,
  threshold,
})

function renderCard(standing: PortfolioWealthTier | null, patrimony = 219_018.63) {
  return render(
    <ThemeRegistry>
      <PortfolioStandingCard
        patrimony={patrimony}
        cagr={24.03}
        cdiPct={185}
        standing={standing}
        formatCurrency={format}
      />
    </ThemeRegistry>,
  )
}

describe('PortfolioStandingCard', () => {
  it('mostra a patente atual, a próxima e o que falta', () => {
    renderCard({
      peak_patrimony: 120_000,
      current_patrimony: 120_000,
      current_tier: tier(3, 'Camponês', 100_000),
      next_tier: tier(4, 'Mercador', 200_000),
      remaining: 80_000,
      progress: 0.2,
      projection: null,
    })

    expect(screen.getByText('Camponês')).toBeInTheDocument()
    expect(screen.getByText('Mercador')).toBeInTheDocument()
    expect(screen.getByText('R$ 80.000')).toBeInTheDocument()
  })

  it('mantém a patente e mostra a distância de hoje quando a carteira caiu', () => {
    /* O pico é 120k e o degrau começa em 100k, mas a carteira hoje vale 30k.
       Os dois lados da regra num caso só: o título não regride, e o que falta
       para Mercador é medido de onde a carteira está — 170k, e não os 80k que
       ela deveria a partir do próprio pico. */
    renderCard({
      peak_patrimony: 120_000,
      current_patrimony: 30_000,
      current_tier: tier(3, 'Camponês', 100_000),
      next_tier: tier(4, 'Mercador', 200_000),
      remaining: 170_000,
      progress: 0,
      projection: null,
    })

    expect(screen.getByText('Camponês')).toBeInTheDocument()
    expect(screen.getByText('R$ 170.000')).toBeInTheDocument()
  })

  it('no topo da escala não promete um próximo degrau', () => {
    renderCard({
      peak_patrimony: 3_000_000,
      current_patrimony: 3_000_000,
      current_tier: tier(11, 'Imperador', 2_000_000),
      next_tier: null,
      remaining: null,
      progress: 1,
      projection: null,
    })

    expect(screen.getByText('Imperador')).toBeInTheDocument()
    expect(screen.queryByText(/Próximo/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Faltam/)).not.toBeInTheDocument()
  })

  it('mostra o patrimônio mesmo sem patente, porque o valor não depende dela', () => {
    /* A escala pode não ter carregado, ou a carteira pode não alcançar nenhum
       degrau. Nos dois casos o patrimônio continua sendo o assunto da faixa. */
    renderCard(null)

    expect(screen.getByText('R$ 219.018,63')).toBeInTheDocument()
    expect(screen.queryByText(/Próximo/)).not.toBeInTheDocument()
  })

  it('mostra patrimônio e patente como um bloco só', () => {
    renderCard({
      peak_patrimony: 254_043.99,
      current_patrimony: 219_018.63,
      current_tier: tier(4, 'Mercador', 200_000),
      next_tier: tier(5, 'Escudeiro', 300_000),
      remaining: 80_981.37,
      progress: 0.19,
      projection: null,
    })

    expect(screen.getByText('R$ 219.018,63')).toBeInTheDocument()
    expect(screen.getByText(/CAGR \+24\.03%/)).toBeInTheDocument()
    expect(screen.getByText('Mercador')).toBeInTheDocument()
    expect(screen.getByText('Escudeiro')).toBeInTheDocument()
  })
})
