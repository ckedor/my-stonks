import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import type { Dayjs } from 'dayjs'

/* Escolha de uma data.
 *
 * Fala `Dayjs` porque é o que o adaptador do calendário fala — o
 * `LocalizationProvider` em `src/theme/index.tsx` é montado com
 * `AdapterDayjs`. Converter para string aqui e de volta lá dentro só
 * moveria a conversão para dentro do design system e ainda perderia o fuso
 * no caminho. */

export interface AppDateFieldProps {
  label: string
  value: Dayjs | null
  onChange: (value: Dayjs | null) => void
}

export default function AppDateField({ label, value, onChange }: AppDateFieldProps) {
  return <DatePicker label={label} value={value} onChange={onChange} />
}
