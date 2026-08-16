import { Typography } from '@mui/material'
import type { ReactNode } from 'react'
import AppStack from './AppStack'
import AppText from './AppText'

/* O número principal de uma tela: rótulo pequeno em cima, valor grande
 * embaixo, e uma linha opcional de contexto.
 *
 * Nasceu do bloco de patrimônio da visão geral, que estava escrito à mão
 * com `variant="h4"`, `fontWeight: 700` e `letterSpacing: '-0.02em'` soltos
 * na página. Qual é o tamanho do número que abre uma tela é decisão do
 * design system, e agora as telas que abrem com um número abrem igual.
 *
 * `detail` é um nó e não uma string porque o que vai ali costuma ter cor
 * própria — um CAGR verde, um percentual do CDI em tom secundário. */

export interface AppHeroMetricProps {
  /** O que está sendo medido. */
  label: string
  /** O valor, já formatado por quem chama — o design system não sabe moeda. */
  value: string
  /** Linha de contexto sob o valor. */
  detail?: ReactNode
}

export default function AppHeroMetric({ label, value, detail }: AppHeroMetricProps) {
  return (
    <AppStack gap="xs">
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
      <Typography variant="h4" fontWeight={700} letterSpacing="-0.02em" lineHeight={1.2}>
        {value}
      </Typography>
      {detail}
    </AppStack>
  )
}
