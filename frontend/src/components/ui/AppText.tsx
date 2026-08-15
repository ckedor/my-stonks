import { Typography } from '@mui/material'
import type { ReactNode } from 'react'

/* Texto corrido.
 *
 * Os nomes são semânticos, não tipográficos: a tela pede `bodySmall` porque
 * aquilo é um texto de apoio, não porque quer 14px. O tamanho é decisão do
 * tema — foi a escolha de tamanho na página que produziu os 20 `fontSize`
 * diferentes que existiam antes.
 *
 * Nasceu com dois variants e dois tons porque é o que as telas usam hoje.
 * (Escrevi este componente uma vez antes e apaguei: na época nenhuma tela
 * precisava dele.) */

type Variant = 'body' | 'bodySmall'
type Tone = 'default' | 'secondary'

const VARIANT: Record<Variant, 'body1' | 'body2'> = {
  body: 'body1',
  bodySmall: 'body2',
}

const TONE: Record<Tone, string | undefined> = {
  default: undefined,
  secondary: 'text.secondary',
}

export interface AppTextProps {
  children: ReactNode
  /** Padrão: `body`. */
  variant?: Variant
  /** Padrão: `default`. */
  tone?: Tone
}

export default function AppText({ children, variant = 'body', tone = 'default' }: AppTextProps) {
  return (
    <Typography variant={VARIANT[variant]} color={TONE[tone]}>
      {children}
    </Typography>
  )
}
