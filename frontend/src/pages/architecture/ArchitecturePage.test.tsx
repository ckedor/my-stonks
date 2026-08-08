import { render, screen } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@mui/material'
import { describe, expect, it } from 'vitest'

import ArchitecturePage from './ArchitecturePage'

describe('ArchitecturePage', () => {
  it('renders the conceptual map as a read-only application page', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <ArchitecturePage />
      </ThemeProvider>,
    )

    expect(screen.getByText('Arquitetura da aplicação')).toBeInTheDocument()
    expect(screen.getByText('Celery Beat')).toBeInTheDocument()
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument()
    expect(screen.getByText('Market Data APIs')).toBeInTheDocument()
  })
})
