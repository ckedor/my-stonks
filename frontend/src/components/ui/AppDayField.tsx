import { TextField } from '@mui/material'

/* Campo de dia, digitado direto no formato do sistema.
 *
 * Irmão do `AppDateField`, e a diferença entre os dois é de gesto: aquele
 * abre um calendário, para a data que se escolhe olhando; este é campo de
 * barra de filtro, onde a data já se sabe e o calendário só põe um clique
 * a mais no caminho. Por isso é compacto e de largura nomeada, como o
 * `AppNumberField`.
 *
 * Fala ISO (`YYYY-MM-DD`) porque é o que o input nativo devolve, e é o
 * formato em que as datas já viajam entre a API e as telas. */

const WIDTH = { auto: undefined, md: 200 } as const

export interface AppDayFieldProps {
  label: string
  /** Data em ISO, ou string vazia para "sem filtro". */
  value: string
  onChange: (value: string) => void
  /** `auto` deixa o navegador dimensionar pelo formato da data; `md` fixa
   *  em 200px, para a barra onde o campo divide a linha. Padrão: `auto`. */
  size?: 'auto' | 'md'
}

export default function AppDayField({ label, value, onChange, size = 'auto' }: AppDayFieldProps) {
  return (
    <TextField
      label={label}
      type="date"
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      /* O rótulo precisa nascer encolhido: o input de data já desenha
         `dd/mm/aaaa` mesmo vazio, e o rótulo grande cairia por cima. */
      slotProps={{ inputLabel: { shrink: true } }}
      sx={{ width: WIDTH[size] }}
    />
  )
}
