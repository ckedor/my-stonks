import { Link as MuiLink } from '@mui/material'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/* Ícone que leva a outra tela.
 *
 * Só o ícone: ao lado do nome de alguma coisa, "Ver no mercado" por extenso
 * pesa mais que o próprio nome, e o ícone já é o idioma de "abre em outro
 * lugar". O rótulo vira o nome acessível.
 *
 * Não é `AppIconButton`: ali a ação acontece na mesma tela, aqui é
 * navegação — e navegação precisa ser um link, para abrir em nova aba e
 * aparecer no histórico. */

export interface AppIconLinkProps {
  /** Rota de destino. */
  to: string
  /** Para onde leva, para leitor de tela. */
  label: string
  children: ReactNode
}

export default function AppIconLink({ to, label, children }: AppIconLinkProps) {
  return (
    <MuiLink
      component={Link}
      to={to}
      color="text.secondary"
      aria-label={label}
      sx={{ display: 'inline-flex', '&:hover': { color: 'text.primary' } }}
    >
      {children}
    </MuiLink>
  )
}
