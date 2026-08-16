import { Typography } from '@mui/material'
import AppStack from './AppStack'

/* Fileira de rótulos curtos onde um está ativo — o seletor de período que
 * mora no canto de um gráfico.
 *
 * Não é `AppButton`: um botão traz preenchimento, borda e área de clique de
 * botão, e uma fileira deles rouba a atenção do gráfico que deveria ser o
 * assunto. Aqui o que muda entre ativo e inativo é só o peso da fonte, que
 * é o suficiente para ler e o mínimo para não competir. */

export interface AppInlineToggleOption<T extends string> {
  label: string
  value: T
}

export interface AppInlineToggleProps<T extends string> {
  options: AppInlineToggleOption<T>[]
  value: T
  onChange: (value: T) => void
}

export default function AppInlineToggle<T extends string>({
  options,
  value,
  onChange,
}: AppInlineToggleProps<T>) {
  return (
    <AppStack direction="row" gap="sm">
      {options.map((option) => (
        <Typography
          key={option.value}
          component="button"
          variant="body2"
          onClick={() => onChange(option.value)}
          aria-pressed={option.value === value}
          sx={{
            /* `button` pelo teclado e pelo leitor de tela, sem a aparência
               de um: o elemento certo semanticamente, despido do resto. */
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'inherit',
            fontWeight: option.value === value ? 700 : 400,
          }}
        >
          {option.label}
        </Typography>
      ))}
    </AppStack>
  )
}
