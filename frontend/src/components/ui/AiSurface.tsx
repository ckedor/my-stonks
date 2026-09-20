import type { ReactNode } from 'react'

import AppCard from './AppCard'
import AppChip from './AppChip'
import AppStack from './AppStack'
import AppText from './AppText'
import { useAppTheme, withOpacity } from './useAppTheme'

/* ──────────────────────────────────────────────
   AiSurface — o que foi escrito por um modelo tem outra moldura
   ──────────────────────────────────────────────

   Existe para que a resposta de IA nunca se confunda com um número apurado
   pela aplicação. A distinção é do desenho, e não de um aviso: a faixa na
   borda, o tom de fundo e o selo "IA" já dizem de onde veio o texto, e são
   consistentes em toda tela que mostrar uma.

   Não há aviso de "a IA pode cometer erros" aqui, e não deve haver. Quem lê
   este app é quem o escreveu, já sabe o que gerou aquilo, e a frase repetida
   em toda tela só ensina a ignorar a moldura junto com ela.

   A cor sai de `palette.primary` em vez de um token novo: um `palette.ai`
   obrigaria a mexer nos 26 temas e no editor de temas do usuário para uma
   distinção que a primária já entrega em todos eles.

   `generatedAt` é parte do desenho e não decoração. Numa feature de validade
   manual, essa data é a única coisa que diz ao leitor se vale pedir uma
   geração nova. */

export interface AiSurfaceProps {
  title: string
  children: ReactNode
  /** Quando a resposta foi gerada. */
  generatedAt?: string
  /** O modelo que respondeu, escrito ao lado da data. */
  model?: string
  /** Ação do cabeçalho — o botão de gerar de novo. */
  action?: ReactNode
}

const TINT_ALPHA = 0.04

function formatGeneratedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AiSurface({
  title,
  children,
  generatedAt,
  model,
  action,
}: AiSurfaceProps) {
  const theme = useAppTheme()
  const accent = theme.palette.primary.main

  const footer = [generatedAt ? `Gerado em ${formatGeneratedAt(generatedAt)}` : null, model]
    .filter(Boolean)
    .join(' · ')

  return (
    <AppCard accentEdge={accent} accentSide="left" tint={withOpacity(accent, TINT_ALPHA)}>
      <AppStack gap="md">
        <AppStack direction="row" align="center" justify="between" gap="sm" wrap>
          <AppStack direction="row" align="center" gap="sm">
            <AppChip label="IA" tint={accent} />
            <AppText variant="bodySmall">{title}</AppText>
          </AppStack>
          {action}
        </AppStack>

        {children}

        {footer ? (
          <AppText variant="caption" tone="secondary">
            {footer}
          </AppText>
        ) : null}
      </AppStack>
    </AppCard>
  )
}
