import { ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'

/* Escolha exclusiva entre poucos modos, em botões colados.
 *
 * O terceiro dos três seletores de uma opção só, e cada um existe por um
 * peso diferente: `AppInlineToggle` é texto puro, para o período no canto
 * de um gráfico; `AppSegmentedToggle` é o trilho de duas opções, para a
 * escolha que vale para a tela inteira; este é o grupo com moldura, para
 * quando as opções mudam *o que* o gráfico desenha e precisam se ler como
 * controle, não como legenda.
 *
 * Nunca fica sem seleção: clicar no que já está ativo não desliga nada.
 * Um gráfico sem modo não tem o que mostrar. */

export interface AppToggleGroupOption<T extends string> {
  label: string
  value: T
}

export interface AppToggleGroupProps<T extends string> {
  options: AppToggleGroupOption<T>[]
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
      {options.map((option) => (
        <ToggleButton key={option.value} value={option.value} sx={{ px: 1, py: 0.25 }}>
          <Typography variant="body2" sx={{ lineHeight: 1.4, fontSize: 12 }}>
            {option.label}
          </Typography>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
