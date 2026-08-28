import { Button, CircularProgress } from '@mui/material'
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
  /** `lg` é a ação única de uma tela — o botão de entrar. Padrão: `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** Ícone à esquerda do rótulo. */
  icon?: ReactNode
  onClick?: () => void
  disabled?: boolean
  /** Põe um spinner no lugar do ícone e recusa cliques enquanto a ação corre.
   *  Sem isso a tela de login enviava duas vezes.
   *
   *  O rótulo fica: ele é o que diz qual ação está correndo, e trocá-lo por um
   *  disco perde justamente isso. É aqui que o spinner de um botão mora — a
   *  regra do ESLint reprova `LoadingSpinner` dentro de `src/pages/**`, e ela
   *  está certa: a espera de uma ação é responsabilidade do controle, não da
   *  tela. */
  loading?: boolean
  type?: 'button' | 'submit'
  /** Ocupa a largura do container — a ação que fecha um formulário em
   *  painel, onde a coluna inteira é o alvo de clique. */
  fullWidth?: boolean
}

export default function AppButton({
  children,
  tone = 'primary',
  emphasis = 'solid',
  size = 'md',
  icon,
  onClick,
  disabled,
  loading = false,
  type = 'button',
  fullWidth = false,
}: AppButtonProps) {
  return (
    <Button
      variant={VARIANT[emphasis]}
      color={COLOR[tone]}
      size={size === 'sm' ? 'small' : size === 'lg' ? 'large' : 'medium'}
      sx={size === 'lg' ? { py: 1.5, fontWeight: 600, fontSize: '1.05rem' } : undefined}
      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : icon}
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      fullWidth={fullWidth}
    >
      {children}
    </Button>
  )
}
