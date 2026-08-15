import { Autocomplete, TextField } from '@mui/material'

/* Seletor com busca por texto.
 *
 * As larguras são as duas que as telas já usavam (420px e 520px), expostas
 * como `size` em vez de continuarem como `sx` na página — a largura de um
 * campo é decisão do design system, e nomeá-la evita o terceiro valor
 * arbitrário aparecer na próxima tela.
 *
 * `filterOptions` é tipado aqui, e não repassado do MUI: a assinatura é uma
 * função pura sobre a lista, então a página consegue limitar o que o
 * dropdown renderiza sem importar nada do MUI. */

export interface AppAutocompleteProps<T> {
  options: T[]
  value: T | null
  onChange: (value: T | null) => void
  /** Texto exibido para cada opção. */
  getOptionLabel: (option: T) => string
  /** Rótulo flutuante do campo. */
  label: string
  /** Compara opção e valor, já que objetos iguais não são o mesmo objeto. */
  isOptionEqualToValue: (option: T, value: T) => boolean
  /** `md` = 420px, `lg` = 520px. Padrão: `md`. */
  size?: 'md' | 'lg'
  /** Filtro próprio — útil quando a lista é grande demais para renderizar. */
  filterOptions?: (options: T[], state: { inputValue: string }) => T[]
}

const WIDTH = { md: 420, lg: 520 } as const

export default function AppAutocomplete<T>({
  options,
  value,
  onChange,
  getOptionLabel,
  label,
  isOptionEqualToValue,
  size = 'md',
  filterOptions,
}: AppAutocompleteProps<T>) {
  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, next) => onChange(next)}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      filterOptions={filterOptions}
      renderInput={(params) => <TextField {...params} label={label} />}
      sx={{ maxWidth: WIDTH[size] }}
    />
  )
}
