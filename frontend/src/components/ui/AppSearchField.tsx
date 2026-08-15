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
}

export default function AppSearchField({
  value,
  onChange,
  placeholder,
  label = 'Buscar',
}: AppSearchFieldProps) {
  return (
    <TextField
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      variant="outlined"
      size="small"
      fullWidth
      sx={{ maxWidth: 400 }}
    />
  )
}
