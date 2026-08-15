import { Button } from '@mui/material'
import type { ReactNode } from 'react'

/* Botão do app.
 *
 * As quatro tonalidades saíram das combinações que as páginas já usavam —
 * `contained`+primary, `outlined`, `text` e `contained`+error. Elas são o
 * vocabulário; `variant` e `color` do MUI não passam adiante, senão cada
 * página volta a inventar a sua combinação. */

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger'

const TONE: Record<Tone, { variant: 'contained' | 'outlined' | 'text'; color: 'primary' | 'error' }> = {
  primary: { variant: 'contained', color: 'primary' },
  secondary: { variant: 'outlined', color: 'primary' },
  ghost: { variant: 'text', color: 'primary' },
  danger: { variant: 'contained', color: 'error' },
}

export interface AppButtonProps {
  children: ReactNode
  /** Peso visual da ação. Padrão: `primary`. */
  tone?: Tone
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
  size = 'md',
  icon,
  onClick,
  disabled,
  type = 'button',
}: AppButtonProps) {
  const { variant, color } = TONE[tone]

  return (
    <Button
      variant={variant}
      color={color}
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
