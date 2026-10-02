import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from '@mui/material'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import AppTooltip from './AppTooltip'

/* A tabela do design system: cabeçalho e linhas, com ordenação e paginação
 * quando pedidas.
 *
 * É a única que desenha linha de dado. `AppCrudTable` (ações por linha) e
 * `AppDataTable` (filtro por dia) são composições desta: cada uma desenhava
 * a própria superfície, com cabeçalho, alinhamento e paginação próprios, e
 * as telas de admin não pareciam do mesmo app que o resto. A outra tabela do
 * design system, `AppHeatmapTable`, é outra coisa — lá a cor da célula é o
 * dado.
 *
 * A célula recebe `render` em vez de um valor porque a tabela não sabe
 * formatar nada: quem chama devolve o nó pronto, inclusive um `AppChip` ou
 * duas linhas de texto empilhadas. */

const CLAMPED_WIDTH = 320
/** O bastante para um seletor mostrar "XPML11 · XP Malls FII" sem cortar. */
const WIDE_WIDTH = 300

/** Deixa a tabela ocupar a tela sem encostar no rodapé dela. */
const VIEWPORT_MAX_HEIGHT = '80vh'

const SURFACE = { paper: 'background.paper', sunken: 'background.default' } as const
const INTERACTIVE_ELEMENT_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
].join(',')

export type AppSimpleTableSort = { column: string; direction: 'asc' | 'desc' }

export interface AppSimpleTableColumn<Row> {
  label: string
  /** O que a coluna responde, em uma frase, para o cabeçalho que é jargão.
   *  Aparece ao passar o mouse. */
  hint?: string
  align?: 'left' | 'right'
  /** `clamped` corta o conteúdo com reticências numa largura fixa — para a
   *  coluna que carrega um texto longo que não pode empurrar as outras.
   *  `wide` garante uma largura mínima — para a coluna que carrega um campo
   *  editável, que a tabela espremeria até o valor virar reticências.
   *  Padrão: `auto`. */
  width?: 'auto' | 'clamped' | 'wide'
  /** A fração da largura da tabela que a coluna ocupa, de 0 a 1. Com ela em
   *  alguma coluna, a tabela passa a ter largura fixa por coluna — é o que
   *  alinha tabelas irmãs empilhadas na mesma tela, uma por grupo, que de
   *  outro jeito medem cada uma o próprio conteúdo e desencontram as colunas. */
  share?: number
  /** Torna a coluna ordenável e diz por qual valor. Sem isto o cabeçalho não
   *  clica, e é assim de propósito para a coluna cujo número só significa
   *  alguma coisa na ordem em que veio — um acumulado por ativo, lido fora da
   *  ordem de data, é um ranking de nada. */
  sortValue?: (row: Row) => string | number | null | undefined
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
  /** Restringe o clique às linhas que possuem um destino real. */
  isRowClickable?: (row: Row) => boolean
  /** Marca a linha em destaque — só faz sentido junto de `onRowClick`. */
  isRowSelected?: (row: Row) => boolean
  /** Mostrado no lugar das linhas quando não há nenhuma. */
  emptyMessage?: string
  /** Altura máxima: passando dela, o corpo rola e o cabeçalho fica parado.
   *  Sem isso uma tabela longa empurra o resto da tela para baixo. Um
   *  número é px; `viewport` é 80% da altura da janela, para a tabela que é
   *  o conteúdo principal da tela e deve caber nela inteira. */
  maxHeight?: number | 'viewport'
  /** Separa pelo fundo linhas de naturezas diferentes na mesma tabela —
   *  compras e vendas. `paper` é a superfície onde a tabela está, `sunken`
   *  é o fundo da página, um degrau abaixo. Sem isso a distinção fica só na
   *  coluna que a nomeia, e a tabela vira um bloco só. */
  getRowSurface?: (row: Row) => 'paper' | 'sunken'
  /** Coluna e sentido iniciais, pelo rótulo de uma coluna com `sortValue`.
   *  Sem isto a tabela mostra as linhas na ordem em que recebeu. */
  defaultSort?: AppSimpleTableSort
  /** Ativa paginação local com uma quantidade fixa de linhas. */
  pageSize?: number
  /** Deixa a pessoa trocar a quantidade de linhas por página entre estas. É
   *  para o histórico longo que se percorre de olho, onde 25 linhas por vez
   *  é pouco. Sem isto a paginação mostra só as setas. */
  pageSizeOptions?: number[]
  /** Reserva a altura do corpo mesmo quando filtro ou página têm poucas linhas. */
  fixedHeight?: number
}

export default function AppSimpleTable<Row>({
  rows,
  columns,
  getRowKey,
  surface = 'none',
  onRowClick,
  isRowClickable,
  isRowSelected,
  emptyMessage,
  maxHeight,
  getRowSurface,
  defaultSort,
  pageSize,
  pageSizeOptions,
  fixedHeight,
}: AppSimpleTableProps<Row>) {
  const height = maxHeight === 'viewport' ? VIEWPORT_MAX_HEIGHT : maxHeight
  const [sort, setSort] = useState<AppSimpleTableSort | undefined>(defaultSort)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(pageSize)

  const sortColumn = sort && columns.find((column) => column.label === sort.column)

  /* Ordena uma cópia: a lista chega de um `useMemo` de quem chama, e ordenar
     no lugar reordenaria o dado memoizado por baixo dele. */
  const sortedRows = useMemo(() => {
    if (!sortColumn?.sortValue) return rows
    const { sortValue } = sortColumn
    const direction = sort?.direction === 'desc' ? -1 : 1

    return [...rows].sort((a, b) => compare(sortValue(a), sortValue(b), direction))
  }, [rows, sortColumn, sort?.direction])

  useEffect(() => setPage(0), [rows, sort])

  const renderedRows = rowsPerPage
    ? sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : sortedRows

  const toggleSort = (label: string) =>
    setSort((current) =>
      current?.column === label
        ? { column: label, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { column: label, direction: 'asc' }
    )

  return (
    <div>
      <TableContainer
        component={surface === 'outlined' ? Paper : 'div'}
        sx={{
          overflowX: 'auto',
          ...(height ? { maxHeight: height, overflowY: 'auto' } : null),
          ...(fixedHeight ? { height: fixedHeight, overflowY: 'auto' } : null),
        }}
      >
        <Table
          size="small"
          stickyHeader={Boolean(height || fixedHeight)}
          sx={columns.some((column) => column.share) ? { tableLayout: 'fixed' } : undefined}
        >
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.label}
                  align={column.align ?? 'left'}
                  sx={{
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    ...(column.share ? { width: `${column.share * 100}%` } : null),
                  }}
                  sortDirection={sort?.column === column.label ? sort.direction : false}
                >
                  <SortableHeader
                    column={column}
                    sort={sort}
                    onToggle={() => toggleSort(column.label)}
                  />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRows.length === 0 && emptyMessage ? (
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
              renderedRows.map((row) => {
                const clickable = Boolean(onRowClick) && (isRowClickable?.(row) ?? true)
                return (
                  <TableRow
                    key={getRowKey(row)}
                    hover
                    selected={isRowSelected?.(row) ?? false}
                    onClick={
                      clickable
                        ? (event) => {
                            const target = event.target
                            if (
                              target instanceof Element &&
                              target.closest(INTERACTIVE_ELEMENT_SELECTOR)
                            ) {
                              return
                            }
                            onRowClick?.(row)
                          }
                        : undefined
                    }
                    sx={{
                      ...(clickable ? { cursor: 'pointer' } : null),
                      ...(getRowSurface ? { backgroundColor: SURFACE[getRowSurface(row)] } : null),
                    }}
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
                            : column.width === 'wide'
                              ? { minWidth: WIDE_WIDTH }
                              : undefined
                        }
                      >
                        {column.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {rowsPerPage && sortedRows.length > 0 && (
        <TablePagination
          component="div"
          count={sortedRows.length}
          page={page}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={pageSizeOptions ?? []}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value))
            setPage(0)
          }}
          labelRowsPerPage="Linhas por página:"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      )}
    </div>
  )
}

/* Número compara como número e texto como texto, na ordem do português —
   `localeCompare` é o que põe "Ávila" junto de "Avila" em vez de depois de
   "Z". Ausente vai para o fim dos dois lados: a linha sem valor não disputa
   o topo do ranking. */
function compare(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  direction: 1 | -1
) {
  if (a == null) return b == null ? 0 : 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return direction * (a - b)
  return direction * String(a).localeCompare(String(b), 'pt-BR')
}

function SortableHeader<Row>({
  column,
  sort,
  onToggle,
}: {
  column: AppSimpleTableColumn<Row>
  sort?: AppSimpleTableSort
  onToggle: () => void
}) {
  const label = column.hint ? (
    <AppTooltip title={column.hint}>{column.label}</AppTooltip>
  ) : (
    column.label
  )

  if (!column.sortValue) return label

  const active = sort?.column === column.label

  return (
    <TableSortLabel active={active} direction={active ? sort?.direction : 'asc'} onClick={onToggle}>
      {label}
    </TableSortLabel>
  )
}
