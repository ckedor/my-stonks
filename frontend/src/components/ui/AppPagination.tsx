import { Pagination } from '@mui/material'

/* Navegação entre páginas de uma lista longa.
 *
 * Só aparece quando há mais de uma página: um controle de paginação com uma
 * página só é ruído que ocupa a mesma altura do de verdade. Quem chama não
 * precisa lembrar disso — o componente devolve nada. */

export interface AppPaginationProps {
  /** Quantidade total de páginas. */
  count: number
  /** Página atual, começando em 1. */
  page: number
  onChange: (page: number) => void
}

export default function AppPagination({ count, page, onChange }: AppPaginationProps) {
  if (count <= 1) return null

  return (
    <Pagination
      count={count}
      page={page}
      onChange={(_, value) => onChange(value)}
      color="primary"
      showFirstButton
      showLastButton
    />
  )
}
