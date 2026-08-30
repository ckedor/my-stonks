import type { FIIPropertiesPoint, FIIProperty } from '@/api/market'
import { renderWithTheme } from '@/theme/test-render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import FIIPropertiesCard from './FIIPropertiesCard'

const building = (overrides: Partial<FIIProperty> = {}): FIIProperty => ({
  name: 'Galpão de Embu',
  identifier: 'a1',
  address: 'Embu das Artes, SP',
  property_class: 'Imóveis para renda acabados',
  area: 77587.2,
  unit_count: 1,
  vacancy_rate: 0.1353,
  delinquency_rate: 0,
  revenue_share: 0.0398,
  leased_rate: null,
  sold_rate: null,
  construction_progress_actual: null,
  construction_progress_expected: null,
  construction_cost_actual: null,
  construction_cost_expected: null,
  invested_share: null,
  confidential: false,
  ...overrides,
})

const quarter = (reference_date: string, vacancy_rate: number): FIIPropertiesPoint => ({
  reference_date,
  summary: {
    count: 2,
    total_area: 100000,
    vacancy_rate,
    average_vacancy_rate: vacancy_rate,
    properties_with_vacancy: 1,
  },
})

const renderCard = (properties: FIIProperty[], history: FIIPropertiesPoint[] = []) =>
  renderWithTheme(
    <FIIPropertiesCard
      properties={properties}
      summary={{
        count: properties.length,
        total_area: 100000,
        vacancy_rate: 0.0327,
        average_vacancy_rate: 0.0378,
        properties_with_vacancy: 1,
      }}
      referenceDate="2026-03-31"
      history={history}
    />,
  )

describe('FIIPropertiesCard', () => {
  it('keeps the columns of a fund that is building out of a finished one', () => {
    renderCard([building()])

    expect(screen.getByText('Vacância')).toBeInTheDocument()
    // A finished income fund fills none of these, and a column of dashes
    // reads as data missing rather than as a fund that builds nothing.
    expect(screen.queryByText('Obra')).not.toBeInTheDocument()
    expect(screen.queryByText('Vendido')).not.toBeInTheDocument()
  })

  it('shows the construction columns as soon as one building is under works', () => {
    renderCard([
      building(),
      building({
        identifier: 'a2',
        name: 'Torre em obras',
        construction_progress_actual: 0.42,
        construction_progress_expected: 0.5,
      }),
    ])

    expect(screen.getByText('Obra')).toBeInTheDocument()
    expect(screen.getByText('42,00% de 50,00%')).toBeInTheDocument()
    // Still nothing sold, so that column stays away.
    expect(screen.queryByText('Vendido')).not.toBeInTheDocument()
  })

  it('states that the filing brought no buildings instead of rendering blank', () => {
    renderCard([])

    expect(
      screen.getByText('O informe trimestral não trouxe imóveis para este fundo.'),
    ).toBeInTheDocument()
  })

  it('offers only the quarterly series the fund actually reported', () => {
    renderCard([building()], [quarter('2025-12-31', 0.029), quarter('2026-03-31', 0.0327)])

    // The picker names the series being drawn; a fund with no vacancy history
    // would leave the chart with its message and no picker at all.
    expect(screen.getByRole('combobox')).toHaveTextContent('Vacância consolidada')
  })
})
