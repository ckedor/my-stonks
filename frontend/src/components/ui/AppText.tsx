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

type Variant = 'body' | 'bodySmall' | 'caption'
type Tone = 'default' | 'secondary' | 'danger'

const VARIANT: Record<Variant, 'body1' | 'body2' | 'caption'> = {
  body: 'body1',
  bodySmall: 'body2',
  caption: 'caption',
}

const TONE: Record<Tone, string | undefined> = {
  default: undefined,
  secondary: 'text.secondary',
  danger: 'error.main',
}

export interface AppTextProps {
  children: ReactNode
  /** Padrão: `body`. */
  variant?: Variant
  /** Padrão: `default`. */
  tone?: Tone
  /** `strong` destaca a linha principal de uma célula com duas linhas.
   *  Padrão: `regular`. */
  weight?: 'regular' | 'strong'
}

export default function AppText({
  children,
  variant = 'body',
  tone = 'default',
  weight = 'regular',
}: AppTextProps) {
  return (
    <Typography
      variant={VARIANT[variant]}
      color={TONE[tone]}
      fontWeight={weight === 'strong' ? 600 : undefined}
    >
      {children}
    </Typography>
  )
}
