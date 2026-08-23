import { InputAdornment, TextField } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

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
  /** Esconde o rótulo flutuante: dentro de um painel o título já diz o que
   *  se busca, e o rótulo repetiria a frase. O nome acessível continua. */
  hideLabel?: boolean
  /** Lupa à esquerda. Serve ao campo sem rótulo, que sem ela se lê como um
   *  campo de texto qualquer. */
  icon?: boolean
  /** Recebe o cursor ao abrir — para o campo que é o motivo de o painel ter
   *  aberto. */
  autoFocus?: boolean
}

const WIDTH = { full: { maxWidth: 400 }, bar: { width: 220, flexShrink: 0 } } as const

export default function AppSearchField({
  value,
  onChange,
  placeholder,
  label = 'Buscar',
  size = 'full',
  hideLabel = false,
  icon = false,
  autoFocus = false,
}: AppSearchFieldProps) {
  return (
    <TextField
      label={hideLabel ? undefined : label}
      aria-label={hideLabel ? label : undefined}
      autoFocus={autoFocus}
      slotProps={
        icon
          ? {
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }
          : undefined
      }
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
