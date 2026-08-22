import { Switch } from '@mui/material'
import AppStack from './AppStack'
import AppText from './AppText'
import AppTooltip from './AppTooltip'

/* Liga e desliga, com o rótulo antes do controle.
 *
 * A ordem é decisão do design system: a barra de um gráfico se lê da
 * esquerda para a direita, e o `FormControlLabel` do MUI inverte isso e
 * ainda traz margens próprias que desalinham a linha. */

export interface AppSwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  /** O que se liga aqui, em uma frase, para o rótulo que é abreviação —
   *  "MM200" não diz nada a quem não conhece a sigla. */
  hint?: string
}

export default function AppSwitch({ label, checked, onChange, hint }: AppSwitchProps) {
  const control = (
    <AppStack direction="row" gap="xs" align="center">
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
      <Switch size="small" checked={checked} onChange={(_, value) => onChange(value)} />
    </AppStack>
  )

  return hint ? <AppTooltip title={hint}>{control}</AppTooltip> : control
}
