import { TextField } from '@mui/material'

/* Campo de busca por texto.
 *
 * Seis telas tinham esse mesmo campo, cada uma repetindo `size`, `variant`,
 * `fullWidth` e um `maxWidth` no `sx`. A largura é decisão do design
 * system, não da página, então mora aqui.
 *
 * O `onChange` entrega a string em vez do evento: a página quer o texto, e
 * quem consome não deveria precisar saber que existe um input do MUI
 * embaixo. */

export interface AppSearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Rótulo flutuante. Padrão: `Buscar`. */
  label?: string
  /** `full` ocupa a largura do container até 400px, para a busca que é a
   *  única coisa da linha; `bar` fixa em 220px, para a barra de filtros
   *  onde ela divide a linha com selects e um `100%` empurraria os vizinhos
   *  para a linha de baixo. Padrão: `full`. */
  size?: 'full' | 'bar'
}

const WIDTH = { full: { maxWidth: 400 }, bar: { width: 220, flexShrink: 0 } } as const

export default function AppSearchField({
  value,
  onChange,
  placeholder,
  label = 'Buscar',
  size = 'full',
}: AppSearchFieldProps) {
  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      variant="outlined"
      size="small"
      fullWidth={size === 'full'}
      sx={WIDTH[size]}
    />
  )
}
