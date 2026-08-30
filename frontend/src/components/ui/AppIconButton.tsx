import { IconButton, Tooltip } from '@mui/material'
import type { MouseEvent, ReactNode } from 'react'
import { withOpacity } from './useAppTheme'

/* Botão de ícone.
 *
 * `label` é obrigatório e não é decorativo: vira o `aria-label` e, quando
 * `tooltip` está ligado, o texto que aparece ao passar o mouse. Um botão que
 * é só um ícone não diz nada a quem usa leitor de tela, e deixar isso
 * opcional é garantir que metade das telas esqueça. */

type Tone = 'default' | 'primary' | 'error' | 'inherit'

const SIZE = { sm: 'small', md: 'medium', lg: 'large' } as const

export interface AppIconButtonProps {
  /** Ícone a renderizar. */
  children: ReactNode
  /** Descrição da ação, para leitor de tela e tooltip. */
  label: string
  /** Recebe o evento porque menus precisam ancorar no elemento clicado. */
  onClick?: (event: MouseEvent<HTMLElement>) => void
  /** Padrão: `default`. */
  tone?: Tone
  /** `sm`/`md`/`lg` mapeiam os três tamanhos que as telas já usam. */
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  /** Mostra `label` como tooltip no hover. */
  tooltip?: boolean
  /** Compensa o padding do ícone nas bordas: `start` quando ele abre uma
   *  barra, `end` quando fica colado na moldura de um campo. */
  edge?: 'start' | 'end' | false
  /** Desenha a moldura, para o botão se ler como botão ao lado de outros.
   *  Sem ela, um ícone solto na mesma linha de dois botões parece
   *  decoração. */
  bordered?: boolean
  /** Seta discreta sobre fotografia: clara, sem fundo em repouso e invisível
   *  quando desabilitada nas pontas de uma galeria. */
  immersive?: boolean
}

export default function AppIconButton({
  children,
  label,
  onClick,
  tone = 'default',
  size = 'md',
  disabled,
  tooltip = false,
  edge = false,
  bordered = false,
  immersive = false,
}: AppIconButtonProps) {
  const sx = immersive
    ? {
        flexShrink: 0,
        color: withOpacity('#ffffff', 0.75),
        '&.Mui-disabled': { opacity: 0 },
        '&:hover': { color: '#fff', backgroundColor: withOpacity('#000000', 0.35) },
      }
    : bordered
      ? { border: '1px solid', borderColor: 'divider', borderRadius: 1 }
      : undefined

  const button = (
    <IconButton
      aria-label={label}
      onClick={onClick}
      color={tone === 'default' ? undefined : tone}
      size={SIZE[size]}
      disabled={disabled}
      edge={edge}
      sx={sx}
    >
      {children}
    </IconButton>
  )

  return tooltip ? <Tooltip title={label}>{button}</Tooltip> : button
}
