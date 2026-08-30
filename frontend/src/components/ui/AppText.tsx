import { Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { useAppTheme } from './useAppTheme'

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

type Variant =
  | 'display'
  | 'pageHeading'
  | 'sceneHeading'
  | 'cardValue'
  | 'body'
  | 'bodySmall'
  | 'caption'
type Tone =
  | 'default'
  | 'secondary'
  | 'primary'
  | 'success'
  | 'caution'
  | 'danger'
  | 'inverse'
  | 'disabled'

/* Os títulos têm peso próprio: um `display` fino não é título, e deixar
 * isso a cargo de quem chama é como reaparecem cinco pesos diferentes. */
const VARIANT_WEIGHT: Partial<Record<Variant, number | 'bold'>> = {
  display: 700,
  pageHeading: 'bold',
  sceneHeading: 900,
  cardValue: 700,
}

const VARIANT: Record<Variant, 'h3' | 'h4' | 'h6' | 'body1' | 'body2' | 'caption'> = {
  /** O maior de todos: a frase que recebe quem chega, numa tela que só tem
   *  ela — a de entrada. */
  display: 'h3',
  /** O nome da coisa que a tela é sobre — o ticker de um ativo. Maior que
   *  o `PageTitle` de propósito: ali o título nomeia a tela, aqui nomeia o
   *  assunto dela. */
  pageHeading: 'h4',
  /** Nome grande escrito diretamente sobre uma cena imersiva. */
  sceneHeading: 'h3',
  /** O número que um card existe para mostrar — o valor da posição num card
   *  de ativo. Menor que o `pageHeading`: o card é um item de uma grade, e
   *  não o assunto da tela. */
  cardValue: 'h6',
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
  inverse: '#fff',
  disabled: 'text.disabled',
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
  /** Cor vinda do dado — a da série que esta linha explica. Ignora o
   *  `tone`: quando a cor é a identidade daquilo, um tom semântico por cima
   *  só confunde. */
  tint?: string
  /** Pinta o texto com o degradê da conquista — do tom do texto ao dourado.
   *  É para o título da tela que celebra algo, e é uma variante e não um
   *  estilo de página justamente porque a tentação de repeti-la é grande:
   *  um app com cinco títulos em degradê não tem nenhum. Ignora `tone`. */
  gradient?: boolean
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
  gradient = false,
  tint,
}: AppTextProps) {
  const theme = useAppTheme()

  const common = {
    variant: VARIANT[variant],
    color: gradient ? undefined : (tint ?? TONE[tone]),
    fontWeight: VARIANT_WEIGHT[variant] ?? (weight === 'strong' ? 600 : undefined),
    whiteSpace: noWrap ? ('nowrap' as const) : undefined,
    ...((gradient || variant === 'sceneHeading')
      ? {
          sx: {
            ...(variant === 'sceneHeading'
              ? { fontSize: { xs: '2.2rem', md: '3.2rem' }, lineHeight: 1.05 }
              : {}),
            ...(gradient
              ? {
            background: `linear-gradient(90deg, ${theme.palette.text.primary}, ${theme.palette.golden})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
                }
              : {}),
          },
        }
      : {}),
  }

  return inline ? (
    <Typography component="span" {...common}>
      {children}
    </Typography>
  ) : (
    <Typography {...common}>{children}</Typography>
  )
}
