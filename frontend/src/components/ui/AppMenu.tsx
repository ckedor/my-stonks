import { Menu, MenuItem, Typography } from '@mui/material'

/* Menu suspenso ancorado a um gatilho.
 *
 * `anchorEl` é um elemento do DOM, não um tipo do MUI, então a tela que usa
 * continua sem importar nada da biblioteca. */

export interface AppMenuOption {
  label: string
  onSelect?: () => void
  /** Item apenas informativo, sem ação. */
  disabled?: boolean
}

export interface AppMenuProps {
  anchorEl: HTMLElement | null
  open: boolean
  onClose: () => void
  options: AppMenuOption[]
  /** Rótulo acessível e id do menu. */
  id: string
}

export default function AppMenu({ anchorEl, open, onClose, options, id }: AppMenuProps) {
  return (
    <Menu
      id={id}
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      open={open}
      onClose={onClose}
    >
      {options.map((option) => (
        <MenuItem
          key={option.label}
          disabled={option.disabled}
          onClick={option.onSelect}
        >
          {option.disabled ? <Typography variant="body2">{option.label}</Typography> : option.label}
        </MenuItem>
      ))}
    </Menu>
  )
}
