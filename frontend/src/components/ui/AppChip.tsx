import { Chip } from '@mui/material'

/* Etiqueta curta de estado. */

type Tone = 'neutral' | 'primary' | 'success' | 'info' | 'danger'

const TONE: Record<Tone, 'default' | 'primary' | 'success' | 'info' | 'error'> = {
  neutral: 'default',
  primary: 'primary',
  success: 'success',
  info: 'info',
  danger: 'error',
}

export interface AppChipProps {
  label: string
  /** Padrão: `neutral`. */
  tone?: Tone
  /** `outline` para estado que ainda não aconteceu — na fila, aguardando.
   *  Vale como peso visual: o estado pendente não deve competir com o que
   *  já é fato. Padrão: `solid`. */
  emphasis?: 'solid' | 'outline'
}

export default function AppChip({ label, tone = 'neutral', emphasis = 'solid' }: AppChipProps) {
  return (
    <Chip
      label={label}
      color={TONE[tone]}
      size="small"
      variant={emphasis === 'outline' ? 'outlined' : 'filled'}
    />
  )
}
