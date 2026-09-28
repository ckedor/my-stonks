import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ThemeRegistry } from '@/theme'
import AppMetric from './AppMetric'
import AppMetricRow from './AppMetricRow'

/* O que mantém a fileira alinhada é o rótulo do número grande descer para o
   tamanho dos vizinhos. Se isto parar de valer, o cabeçalho volta a ficar
   torto em toda tela que abre com um `lg` ao lado de `sm` — sem nenhum erro. */

describe('AppMetricRow', () => {
  it('dá ao rótulo do número grande o tamanho dos vizinhos', () => {
    render(
      <ThemeRegistry>
        <AppMetricRow>
          <AppMetric label="Patrimônio" value="R$ 1" size="lg" />
          <AppMetric label="CAGR" value="+7%" />
        </AppMetricRow>
      </ThemeRegistry>,
    )

    expect(screen.getByText('Patrimônio').className).toContain('MuiTypography-caption')
    expect(screen.getByText('CAGR').className).toContain('MuiTypography-caption')
  })

  it('fora da fileira, o número grande mantém o rótulo maior', () => {
    render(
      <ThemeRegistry>
        <AppMetric label="Patrimônio" value="R$ 1" size="lg" />
      </ThemeRegistry>,
    )

    expect(screen.getByText('Patrimônio').className).toContain('MuiTypography-body2')
  })
})
