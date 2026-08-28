import { Box, Divider, Menu, MenuItem, Typography } from '@mui/material'
import { Fragment, type ReactNode } from 'react'

/* Menu suspenso ancorado a um gatilho.
 *
 * `anchorEl` é um elemento do DOM, não um tipo do MUI, então a tela que usa
 * continua sem importar nada da biblioteca.
 *
 * Um item, um jeito de desenhar: ícone colado ao rótulo, com o mesmo
 * respiro em qualquer menu do app. Antes disso havia três recuos de ícone
 * diferentes em três menus da mesma barra — o tipo de divergência que só
 * aparece quando alguém abre os dois seguidos. */

const ICON_GAP = 1

export interface AppMenuOption {
  label: string
  onSelect?: () => void
  /** Item apenas informativo, sem ação. */
  disabled?: boolean
  /** Ícone à esquerda do rótulo. */
  icon?: ReactNode
  /** `golden` é o realce da troca de tema, o mesmo do `ThemeToggleButton` —
   *  o ícone é a informação ali, e a cor é o que o separa do resto da
   *  lista. */
  iconTone?: 'default' | 'golden'
  /** Marca o item que corresponde ao estado atual. */
  selected?: boolean
  /** `accent` destaca a ação que cria ou edita algo. */
  tone?: 'default' | 'accent'
  /** Régua acima do item, separando grupos de ações. */
  separatorBefore?: boolean
}

export interface AppMenuProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  options: AppMenuOption[]
  /** Rótulo acessível e id do menu. */
  id: string
  /** Largura mínima do painel, quando os rótulos são curtos demais para
   *  sustentar a coluna sozinhos. */
  minWidth?: number
  /** Onde o painel abre em relação ao gatilho. `below` é o menu de barra —
   *  cai sob o botão, alinhado à direita. `beside` é o submenu de uma coluna
   *  de navegação: sai pelo lado, alinhado ao topo do item, para não cobrir
   *  os destinos logo abaixo dele. Padrão: `below`. */
  placement?: 'below' | 'beside'
}

export default function AppMenu({
  anchorEl,
  open,
  onClose,
  options,
  id,
  minWidth,
  placement = 'below',
}: AppMenuProps) {
  const beside = placement === 'beside'

  return (
    <Menu
      id={id}
      anchorEl={anchorEl}
      anchorOrigin={
        beside
          ? { vertical: 'top', horizontal: 'right' }
          : { vertical: 'bottom', horizontal: 'right' }
      }
      keepMounted
      transformOrigin={
        beside
          ? { vertical: 'top', horizontal: 'left' }
          : { vertical: 'top', horizontal: 'right' }
      }
      open={open}
      onClose={onClose}
      slotProps={minWidth ? { paper: { sx: { minWidth } } } : undefined}
    >
      {options.map((option) => {
        const color = option.tone === 'accent' ? 'primary.main' : undefined

        return (
          <Fragment key={option.label}>
            {option.separatorBefore && <Divider />}
            <MenuItem
              disabled={option.disabled}
              selected={option.selected}
              onClick={option.onSelect}
              sx={{ gap: option.icon ? ICON_GAP : 0, color }}
            >
              {option.icon && (
                <Box
                  sx={{
                    display: 'flex',
                    color: option.iconTone === 'golden' ? 'golden' : undefined,
                  }}
                >
                  {option.icon}
                </Box>
              )}
              {option.disabled ? (
                <Typography variant="body2">{option.label}</Typography>
              ) : (
                option.label
              )}
            </MenuItem>
          </Fragment>
        )
      })}
    </Menu>
  )
}
