import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import AppTooltip from './AppTooltip'

/* Escolha exclusiva entre poucos modos, em botões colados.
 *
 * O controle segmentado das telas: o modo de um gráfico e a lista-ou-cards
 * de uma listagem são o mesmo desenho. Havia uma segunda apresentação,
 * `view`, com fundo e segmento elevado, usada numa tela só — dois controles
 * segmentados na mesma superfície não dizem nada um do outro.
 *
 * Os vizinhos ficam por superfície e peso, não por gosto: o
 * `AppSegmentedToggle` é o da barra do topo, que tem fundo próprio e onde
 * estes botões somem; o `AppInlineToggle` é texto puro, para o período no
 * canto de um gráfico, onde até a moldura compete com o desenho.
 *
 * Nunca fica sem seleção: clicar no que já está ativo não desliga nada.
 * Um gráfico sem modo não tem o que mostrar. */

export interface AppToggleGroupOption<T extends string> {
  /** Vira o nome acessível mesmo quando só o ícone aparece. */
  label: string
  value: T
  /** No lugar do rótulo. O rótulo continua sendo o nome acessível. */
  icon?: ReactNode
  /** O que a opção faz, em uma frase, para o rótulo que é abreviação. */
  hint?: string
  /** Motivo para não poder ser escolhida agora. */
  disabled?: boolean
}

export interface AppToggleGroupProps<T extends string> {
  options: readonly AppToggleGroupOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Rótulo acessível do grupo. */
  label: string
}

export default function AppToggleGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: AppToggleGroupProps<T>) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      aria-label={label}
      value={value}
      onChange={(_, next: T | null) => next && onChange(next)}
    >
      {options.map((option) => {
        const content = option.icon ?? (
          <Typography variant="body2" sx={{ lineHeight: 1.4, fontSize: 12 }}>
            {option.label}
          </Typography>
        )
        return (
          <ToggleButton
            key={option.value}
            value={option.value}
            aria-label={option.label}
            disabled={option.disabled}
            sx={{ px: 1, py: 0.25 }}
          >
            {option.hint ? <AppTooltip title={option.hint}>{content}</AppTooltip> : content}
          </ToggleButton>
        )
      })}
    </ToggleButtonGroup>
  )
}
