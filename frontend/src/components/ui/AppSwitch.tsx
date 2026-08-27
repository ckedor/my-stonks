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
  /** A frase que explica o que ligar isso muda. Com ela o interruptor troca
   *  de forma: vem antes do texto e o rótulo vira o título da linha — é o
   *  arranjo de uma tela de configuração, onde a explicação é tão parte do
   *  item quanto o nome. Sem ela, continua sendo o par curto de uma barra
   *  de controles. */
  description?: string
  /** O que se liga aqui, em uma frase, para o rótulo que é abreviação —
   *  "MM200" não diz nada a quem não conhece a sigla. */
  hint?: string
}

export default function AppSwitch({
  label,
  checked,
  onChange,
  hint,
  description,
}: AppSwitchProps) {
  if (description) {
    return (
      <AppStack direction="row" gap="sm" align="start">
        <Switch
          checked={checked}
          onChange={(_, value) => onChange(value)}
          slotProps={{ input: { 'aria-label': label } }}
        />
        <AppStack gap="none">
          <AppText weight="strong">{label}</AppText>
          <AppText variant="bodySmall" tone="secondary">
            {description}
          </AppText>
        </AppStack>
      </AppStack>
    )
  }

  const control = (
    <AppStack direction="row" gap="xs" align="center">
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
      {/* O rótulo é texto ao lado, não um `<label>` ligado ao input: sem o
          `aria-label` o leitor de tela anuncia um interruptor sem nome, e o
          teste não tem como alcançá-lo. */}
      <Switch
        size="small"
        checked={checked}
        onChange={(_, value) => onChange(value)}
        slotProps={{ input: { 'aria-label': label } }}
      />
    </AppStack>
  )

  return hint ? <AppTooltip title={hint}>{control}</AppTooltip> : control
}
