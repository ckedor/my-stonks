import { MenuItem, TextField } from '@mui/material'

/* Escolha de um valor entre poucos.
 *
 * Diferente do `AppAutocomplete`, que existe para lista longa e por isso
 * carrega busca: aqui a lista cabe na tela e o campo de busca só atrapalha.
 *
 * As opções chegam como dados, e não como filhos: `<MenuItem>` na página
 * seria o MUI vazando para fora do design system pela porta dos fundos. */

export interface AppSelectOption {
  value: string
  label: string
}

export interface AppSelectProps {
  options: AppSelectOption[]
  value: string
  onChange: (value: string) => void
  /** Rótulo flutuante. Omitido, o campo aparece sem rótulo — é o que serve
   *  numa barra de gráfico, onde o contexto já está na tela. */
  label?: string
  /** `sm` = 180px, `md` = 260px. Padrão: `sm`. */
  size?: 'sm' | 'md'
}

const WIDTH = { sm: 180, md: 260 } as const

export default function AppSelect({
  options,
  value,
  onChange,
  label,
  size = 'sm',
}: AppSelectProps) {
  return (
    <TextField
      select
      size="small"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      /* Largura fixa, e não `100%` limitado por `maxWidth`: numa barra em
         flex o `100%` faz o campo reivindicar a linha inteira e empurrar o
         vizinho para a linha de baixo — que é justamente o empilhamento que
         a barra existe para não ter. */
      sx={{ width: WIDTH[size], flexShrink: 0 }}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  )
}
