import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import AppCard from './AppCard'
import AppStack from './AppStack'
import AppText from './AppText'

/* Card de um número só: rótulo em cima, valor grande, apoio embaixo.
 *
 * Não sabe domínio nenhum — recebe três textos e um ícone —, então é
 * camada 1 pela regra, mesmo tendo nascido dos três cards de resumo da
 * tela de importação.
 *
 * O `minWidth` mora aqui e não em quem chama: uma fileira de tiles onde um
 * é mais estreito que o outro é justamente o que o design system existe
 * para impedir. Quem chama decide só quantos cabem na linha, pelo
 * `AppStack`. */

export interface AppStatCardProps {
  /** O que está sendo medido. */
  label: string
  /** O número em si. */
  value: string | number
  /** Uma linha de contexto sob o valor. */
  helper: string
  /** Ícone no canto, na cor primária. */
  icon?: ReactNode
}

export default function AppStatCard({ label, value, helper, icon }: AppStatCardProps) {
  return (
    <AppCard sx={{ minWidth: 190, flex: 1 }}>
      <AppStack gap="xs">
        <AppStack direction="row" justify="between" align="start">
          <AppStack gap="xs">
            <AppText variant="bodySmall" tone="secondary">
              {label}
            </AppText>
            <Typography variant="h4">{value}</Typography>
          </AppStack>
          {icon && <Box color="primary.main">{icon}</Box>}
        </AppStack>
        <AppText variant="caption" tone="secondary">
          {helper}
        </AppText>
      </AppStack>
    </AppCard>
  )
}
