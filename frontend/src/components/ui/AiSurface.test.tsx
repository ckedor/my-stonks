import { renderWithTheme } from '@/theme/test-render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AiSurface from './AiSurface'

/* A moldura existe para que o texto de um modelo nunca se confunda com um
   número apurado pela aplicação. O selo e a data são o que diz isso — e o
   aviso de que "a IA pode errar" não deve existir em lugar nenhum. */

describe('AiSurface', () => {
  it('marca o conteúdo como sendo de IA', () => {
    renderWithTheme(
      <AiSurface title="O que é este ativo">
        <span>texto gerado</span>
      </AiSurface>,
    )

    expect(screen.getByText('IA')).toBeInTheDocument()
    expect(screen.getByText('O que é este ativo')).toBeInTheDocument()
    expect(screen.getByText('texto gerado')).toBeInTheDocument()
  })

  it('diz quando foi gerado e por qual modelo', () => {
    renderWithTheme(
      <AiSurface title="Título" generatedAt="2026-09-05T14:30:00Z" model="gpt-4o">
        <span>texto</span>
      </AiSurface>,
    )

    expect(screen.getByText(/Gerado em/)).toBeInTheDocument()
    expect(screen.getByText(/gpt-4o/)).toBeInTheDocument()
  })

  it('sem data e sem modelo, não escreve rodapé nenhum', () => {
    renderWithTheme(
      <AiSurface title="Título">
        <span>texto</span>
      </AiSurface>,
    )

    expect(screen.queryByText(/Gerado em/)).not.toBeInTheDocument()
  })

  it('não espalha aviso de que a IA pode errar', () => {
    renderWithTheme(
      <AiSurface title="Título" generatedAt="2026-09-05T14:30:00Z" model="gpt-4o">
        <span>texto</span>
      </AiSurface>,
    )

    expect(screen.queryByText(/pode cometer erros/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/verifique/i)).not.toBeInTheDocument()
  })
})
