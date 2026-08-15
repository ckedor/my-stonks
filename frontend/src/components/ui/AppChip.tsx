import { Chip } from '@mui/material'

/* Etiqueta curta de estado. */

type Tone = 'neutral' | 'primary' | 'success' | 'info'

const TONE: Record<Tone, 'default' | 'primary' | 'success' | 'info'> = {
  neutral: 'default',
  primary: 'primary',
  success: 'success',
  info: 'info',
}

export interface AppChipProps {
  label: string
  /** Padrão: `neutral`. */
  tone?: Tone
}

export default function AppChip({ label, tone = 'neutral' }: AppChipProps) {
  return <Chip label={label} color={TONE[tone]} size="small" />
}
