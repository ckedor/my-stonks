import { Box, Typography } from '@mui/material'

/* O número de um passo, dentro de um círculo.
 *
 * Existe para a lista em que a ordem é o conteúdo — as etapas de um fluxo —,
 * onde um marcador solto não diz que o terceiro item vem depois do segundo. */

const SIZE = 22

export interface AppStepBadgeProps {
  /** Posição do passo, começando em 1. */
  step: number
}

export default function AppStepBadge({ step }: AppStepBadgeProps) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        bgcolor: 'action.hover',
        color: 'text.secondary',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Typography variant="caption" fontWeight={700}>
        {step}
      </Typography>
    </Box>
  )
}
