import { Chip } from '@mui/material'
import { INTENT_COLOR, type Intent } from './intent'

/* Etiqueta curta de estado. */

/* `caution` é o meio-termo que não é erro: um valuation esticado, um impacto
 * que pede atenção. Mesmo eixo do `caution` do AppButton. */
type Tone = 'neutral' | Intent

export interface AppChipProps {
  label: string
  /** Padrão: `neutral`. */
  tone?: Tone
  /** Cor vinda do dado — a que o usuário escolheu para a categoria. Tinge
   *  o fundo e escreve o rótulo nela, e ignora o `tone`: quando a cor é a
   *  identidade daquilo, um verde de "sucesso" por cima só confunde. */
  tint?: string
  /** `outline` para estado que ainda não aconteceu — na fila, aguardando.
   *  Vale como peso visual: o estado pendente não deve competir com o que
   *  já é fato. Padrão: `solid`. */
  emphasis?: 'solid' | 'outline'
}

const TINT_BACKGROUND_ALPHA = '22'

export default function AppChip({
  label,
  tone = 'neutral',
  emphasis = 'solid',
  tint,
}: AppChipProps) {
  return (
    <Chip
      label={label}
      color={tint ? undefined : tone === 'neutral' ? 'default' : INTENT_COLOR[tone]}
      size="small"
      variant={emphasis === 'outline' ? 'outlined' : 'filled'}
      sx={
        tint
          ? { bgcolor: `${tint}${TINT_BACKGROUND_ALPHA}`, color: tint, fontWeight: 600 }
          : undefined
      }
    />
  )
}
