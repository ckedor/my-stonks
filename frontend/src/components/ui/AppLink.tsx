import { Link as MuiLink } from '@mui/material'
import { Link } from 'react-router-dom'

/* Texto que leva a outro lugar.
 *
 * `to` navega dentro do app; `href` sai dele. São coisas diferentes — uma
 * troca a tela sem recarregar, a outra abandona a sessão — e a prop diz
 * qual é sem que quem lê precise adivinhar. */

export interface AppLinkProps {
  children: string
  /** Rota interna. */
  to?: string
  /** Endereço externo. */
  href?: string
}

export default function AppLink({ children, to, href }: AppLinkProps) {
  if (to) {
    return (
      <MuiLink component={Link} to={to} variant="body2" underline="hover" color="primary">
        {children}
      </MuiLink>
    )
  }

  return (
    <MuiLink href={href} variant="body2" underline="hover" color="primary">
      {children}
    </MuiLink>
  )
}
