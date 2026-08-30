import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import AppTooltip from './AppTooltip'

/* Um número com o nome dele em cima.
 *
 * O rótulo é pequeno e apagado, o valor é o que se lê — a ordem inversa da
 * lista de `rótulo: valor`, que dá ao nome o mesmo peso do número e faz a
 * faixa inteira ler como formulário.
 *
 * `lg` é o número principal da tela, `sm` são os que o qualificam ao lado. */

type Tone = 'default' | 'secondary' | 'success' | 'danger'

const TONE: Record<Tone, string | undefined> = {
  default: undefined,
  secondary: 'text.secondary',
  success: 'success.main',
  danger: 'error.main',
}

/** Largura mínima no mobile: sem ela os itens de uma linha que quebra
 *  encolhem até o rótulo virar duas linhas. */
const MIN_WIDTH_XS = 128

export interface AppMetricProps {
  label: string
  value: string
  /** Padrão: `sm`. */
  size?: 'sm' | 'lg'
  /** Padrão: `default`. */
  tone?: Tone
  /** Colado ao lado do valor, na mesma linha de base — a taxa que qualifica
   *  o número sem virar uma métrica própria. */
  suffix?: ReactNode
  /** `center` para a fileira de números que legenda um gráfico, onde o
   *  alinhamento à esquerda deixa os rótulos desencontrados dos valores.
   *  Padrão: `start`. */
  align?: 'start' | 'center'
  /** O que o número responde, em uma frase, para o rótulo que é jargão —
   *  "P/VP" não diz nada a quem não conhece a sigla. Marca o rótulo com um
   *  sublinhado pontilhado, que é o que avisa que há o que ler ali. */
  hint?: string
}

export default function AppMetric({
  label,
  value,
  size = 'sm',
  tone = 'default',
  suffix,
  align = 'start',
  hint,
}: AppMetricProps) {
  const heading = (
    <Typography
      variant={size === 'lg' ? 'body2' : 'caption'}
      color="text.secondary"
      sx={{
        /* Com dica, o rótulo encolhe até o próprio texto: em `block` o
           sublinhado pontilhado atravessava a coluna inteira e virava uma
           régua entre o rótulo e o número, em vez de marcar a palavra que
           tem o que ler. */
        display: hint ? 'inline-block' : 'block',
        lineHeight: 1.2,
        ...(hint
          ? { borderBottom: '1px dotted', borderColor: 'text.disabled', cursor: 'help' }
          : null),
      }}
    >
      {label}
    </Typography>
  )

  return (
    <Box sx={{ minWidth: { xs: MIN_WIDTH_XS, sm: 'auto' }, textAlign: align }}>
      {hint ? <AppTooltip title={hint}>{heading}</AppTooltip> : heading}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
          gap: 1,
        }}
      >
        <Typography
          variant={size === 'lg' ? 'h5' : 'body1'}
          sx={{ fontWeight: 700, color: TONE[tone], lineHeight: size === 'lg' ? 1.15 : 1.35 }}
        >
          {value}
        </Typography>
        {suffix}
      </Box>
    </Box>
  )
}
