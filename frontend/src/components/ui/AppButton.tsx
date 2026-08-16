import { Button } from '@mui/material'
import type { ReactNode } from 'react'

/* Botão do app.
 *
 * `tone` diz a intenção (do que se trata) e `emphasis` diz o peso (quanto
 * a ação deve puxar o olho). Os dois nasceram fundidos numa prop só —
 * `secondary` e `ghost` eram peso, `danger` era intenção — e a fusão parou
 * de fechar na tela de importação, que precisa de um "abortar" vermelho
 * discreto e um "histórico completo" âmbar discreto: combinações que não
 * tinham nome porque não cabiam num eixo. Separá-los é a mesma decisão já
 * tomada no `AppChip`.
 *
 * As combinações antigas seguem existindo, agora escritas em dois eixos:
 * `secondary` = primary + outline, `ghost` = primary + ghost,
 * `danger` = danger + solid. */

type Tone = 'primary' | 'danger' | 'caution'
type Emphasis = 'solid' | 'outline' | 'ghost'

const COLOR: Record<Tone, 'primary' | 'error' | 'warning'> = {
  primary: 'primary',
  danger: 'error',
  caution: 'warning',
}

const VARIANT: Record<Emphasis, 'contained' | 'outlined' | 'text'> = {
  solid: 'contained',
  outline: 'outlined',
  ghost: 'text',
}

export interface AppButtonProps {
  children: ReactNode
  /** Do que se trata a ação. Padrão: `primary`. */
  tone?: Tone
  /** Quanto peso visual ela carrega. Padrão: `solid`. */
  emphasis?: Emphasis
  size?: 'sm' | 'md'
  /** Ícone à esquerda do rótulo. */
  icon?: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

export default function AppButton({
  children,
  tone = 'primary',
  emphasis = 'solid',
  size = 'md',
  icon,
  onClick,
  disabled,
  type = 'button',
}: AppButtonProps) {
  return (
    <Button
      variant={VARIANT[emphasis]}
      color={COLOR[tone]}
      size={size === 'sm' ? 'small' : 'medium'}
      startIcon={icon}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </Button>
  )
}
