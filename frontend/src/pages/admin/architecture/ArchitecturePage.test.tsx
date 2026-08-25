import { renderWithTheme } from '@/theme/test-render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import ArchitecturePage from './ArchitecturePage'

describe('ArchitecturePage', () => {
  it('renders the conceptual map as a read-only application page', () => {
    renderWithTheme(<ArchitecturePage />)

    expect(screen.getByText('Arquitetura da aplicação')).toBeInTheDocument()
    expect(screen.getByText('Celery Beat')).toBeInTheDocument()
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument()
    expect(screen.getByText('Brapi')).toBeInTheDocument()
  })
})
