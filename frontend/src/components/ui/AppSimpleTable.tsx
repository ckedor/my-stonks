import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import type { ReactNode } from 'react'

/* Tabela estática: cabeçalho e linhas, sem paginação nem ordenação.
 *
 * Quarta tabela do design system, e a mais crua das quatro — as outras três
 * são esta mais alguma coisa: `AppTable` soma formatação de moeda e linha de
 * total, `AppCrudTable` soma ações por linha, `AppDataTable` soma filtro por
 * data, ordenação e paginação. Elas não foram reescritas em cima desta agora
 * porque cada uma desenha a própria superfície, e trocar isso mexeria no
 * visual de telas já migradas. Quando o portfolio migrar e os casos de uso
 * estiverem todos à vista, a unificação vira uma mudança só.
 *
 * A célula recebe `render` em vez de um valor porque a tabela não sabe
 * formatar nada: quem chama devolve o nó pronto, inclusive um `AppChip` ou
 * duas linhas de texto empilhadas. */

const CLAMPED_WIDTH = 320

export interface AppSimpleTableColumn<Row> {
  label: string
  align?: 'left' | 'right'
  /** `clamped` corta o conteúdo com reticências numa largura fixa — para a
   *  coluna que carrega um texto longo que não pode empurrar as outras.
   *  Padrão: `auto`. */
  width?: 'auto' | 'clamped'
  render: (row: Row) => ReactNode
}

export interface AppSimpleTableProps<Row> {
  rows: Row[]
  columns: AppSimpleTableColumn<Row>[]
  /** Identidade estável da linha, para a key do React. */
  getRowKey: (row: Row) => string | number
  /** `outlined` desenha a própria superfície; sem isso a tabela assume que
   *  já está dentro de um `AppCard`. Padrão: `none`. */
  surface?: 'none' | 'outlined'
  /** Torna a linha clicável. */
  onRowClick?: (row: Row) => void
  /** Marca a linha em destaque — só faz sentido junto de `onRowClick`. */
  isRowSelected?: (row: Row) => boolean
  /** Mostrado no lugar das linhas quando não há nenhuma. */
  emptyMessage?: string
  /** Altura máxima em px: passando dela, o corpo rola e o cabeçalho fica
   *  parado. Sem isso uma tabela longa empurra o resto da tela para baixo. */
  maxHeight?: number
}

export default function AppSimpleTable<Row>({
  rows,
  columns,
  getRowKey,
  surface = 'none',
  onRowClick,
  isRowSelected,
  emptyMessage,
  maxHeight,
}: AppSimpleTableProps<Row>) {
  return (
    <TableContainer
      component={surface === 'outlined' ? Paper : 'div'}
      sx={{ overflowX: 'auto', ...(maxHeight ? { maxHeight, overflowY: 'auto' } : null) }}
    >
      <Table size="small" stickyHeader={Boolean(maxHeight)}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.label}
                align={column.align ?? 'left'}
                sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 && emptyMessage ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                align="center"
                sx={{ py: 4, color: 'text.secondary' }}
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={getRowKey(row)}
                hover
                selected={isRowSelected?.(row) ?? false}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.label}
                    align={column.align ?? 'left'}
                    sx={
                      column.width === 'clamped'
                        ? {
                            maxWidth: CLAMPED_WIDTH,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }
                        : undefined
                    }
                  >
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
