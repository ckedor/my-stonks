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

type Variant = 'pageHeading' | 'body' | 'bodySmall' | 'caption'
type Tone = 'default' | 'secondary' | 'primary' | 'success' | 'caution' | 'danger'

const VARIANT: Record<Variant, 'h4' | 'body1' | 'body2' | 'caption'> = {
  /** O nome da coisa que a tela é sobre — o ticker de um ativo. Maior que
   *  o `PageTitle` de propósito: ali o título nomeia a tela, aqui nomeia o
   *  assunto dela. */
  pageHeading: 'h4',
  body: 'body1',
  bodySmall: 'body2',
  caption: 'caption',
}

const TONE: Record<Tone, string | undefined> = {
  default: undefined,
  secondary: 'text.secondary',
  primary: 'primary.main',
  success: 'success.main',
  caution: 'warning.main',
  danger: 'error.main',
}

export interface AppTextProps {
  children: ReactNode
  /** Padrão: `body`. */
  variant?: Variant
  /** `success`, `caution` e `danger` são os três degraus de um número que
   *  se lê pelo sinal — um retorno, uma perda, uma métrica de risco.
   *  Padrão: `default`. */
  tone?: Tone
  /** `strong` destaca a linha principal de uma célula com duas linhas.
   *  Padrão: `regular`. */
  weight?: 'regular' | 'strong'
  /** Impede a quebra de linha — para o número que não pode virar duas
   *  linhas quando a coluna aperta. */
  noWrap?: boolean
  /** Renderiza como `span`, para o trecho destacado dentro de uma frase.
   *  Sem isto o texto vira um parágrafo dentro de outro, que o navegador
   *  desfaz quebrando a linha no meio. */
  inline?: boolean
}

export default function AppText({
  children,
  variant = 'body',
  tone = 'default',
  weight = 'regular',
  noWrap = false,
  inline = false,
}: AppTextProps) {
  const common = {
    variant: VARIANT[variant],
    color: TONE[tone],
    fontWeight: weight === 'strong' ? 600 : variant === 'pageHeading' ? 'bold' : undefined,
    whiteSpace: noWrap ? ('nowrap' as const) : undefined,
  }

  return inline ? (
    <Typography component="span" {...common}>
      {children}
    </Typography>
  ) : (
    <Typography {...common}>{children}</Typography>
  )
}
