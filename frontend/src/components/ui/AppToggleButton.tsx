import { ToggleButton, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import AppTooltip from './AppTooltip'

/* Botão que fica pressionado — uma ferramenta que se liga e se desliga.
 *
 * Não é `AppSwitch`: o interruptor diz que uma camada aparece ou some do
 * desenho, e é o que serve para volume e média móvel. Este diz que uma
 * ferramenta está na mão, agindo *sobre* o gráfico em vez de mudar o que
 * ele plota, e por isso se lê como instrumento e fica separado dos
 * interruptores. */

export interface AppToggleButtonProps {
  label: string
  pressed: boolean
  onChange: (pressed: boolean) => void
  icon?: ReactNode
  /** Como se usa a ferramenta, em uma frase. */
  hint?: string
}

export default function AppToggleButton({
  label,
  pressed,
  onChange,
  icon,
  hint,
}: AppToggleButtonProps) {
  const button = (
    <ToggleButton
      size="small"
      value={label}
      selected={pressed}
      aria-label={label}
      onChange={() => onChange(!pressed)}
      sx={{ px: 1, py: 0.25, gap: 0.5 }}
    >
      {icon}
      <Typography variant="body2" sx={{ lineHeight: 1.4, fontSize: 12 }}>
        {label}
      </Typography>
    </ToggleButton>
  )

  return hint ? <AppTooltip title={hint}>{button}</AppTooltip> : button
}
