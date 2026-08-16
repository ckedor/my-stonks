import { Switch } from '@mui/material'
import AppStack from './AppStack'
import AppText from './AppText'

/* Liga e desliga, com o rótulo antes do controle.
 *
 * A ordem é decisão do design system: a barra de um gráfico se lê da
 * esquerda para a direita, e o `FormControlLabel` do MUI inverte isso e
 * ainda traz margens próprias que desalinham a linha. */

export interface AppSwitchProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export default function AppSwitch({ label, checked, onChange }: AppSwitchProps) {
  return (
    <AppStack direction="row" gap="xs" align="center">
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
      <Switch size="small" checked={checked} onChange={(_, value) => onChange(value)} />
    </AppStack>
  )
}
