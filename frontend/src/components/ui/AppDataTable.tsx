/* Histórico paginado, do mais recente para o mais antigo, com busca por dia.
 *
 * Desenha com o `AppSimpleTable`: o que mora aqui é a ordem pela data, a
 * busca de um dia e o aviso de quando ela não acha nada. Antes tinha
 * superfície, cabeçalho e paginação próprios, e as três telas de histórico
 * não pareciam do mesmo app que o resto.
 *
 * Toda linha já está carregada, então a ordem e a busca rodam em memória em
 * vez de custar outra ida ao servidor. */

import { useMemo, useState } from 'react'
import AppAlert from './AppAlert'
import AppButton from './AppButton'
import AppDayField from './AppDayField'
import AppSimpleTable, { type AppSimpleTableColumn } from './AppSimpleTable'
import AppStack from './AppStack'
import { formatDate } from '@/lib/utils/format'

const PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [25, 50, 100]

export interface AppDataTableColumn<Row> {
  label: string
  align?: 'left' | 'right'
  render: (row: Row) => React.ReactNode
}

/* A tabela pede uma chave por linha, e o histórico não tem id: a posição na
   lista recebida é a identidade, e ela não muda com a ordem nem com a busca. */
interface Indexed<Row> {
  row: Row
  index: number
}

export default function AppDataTable<Row>({
  rows,
  columns,
  emptyMessage,
  getDate,
}: {
  rows: Row[]
  /** A primeira coluna é a da data: é ela que ordena. */
  columns: AppDataTableColumn<Row>[]
  emptyMessage: string
  /** Data ISO da linha, para a ordem e para a busca por dia. */
  getDate: (row: Row) => string
}) {
  const [dayFilter, setDayFilter] = useState('')

  /* Sem busca, a lista é a mesma referência a cada render: o `getDate` chega
     escrito inline, e uma lista nova a cada render da tela voltaria a tabela
     para a primeira página. */
  const indexed = useMemo(() => rows.map((row, index) => ({ row, index })), [rows])
  const visibleRows = useMemo(
    () =>
      dayFilter
        ? indexed.filter(({ row }) => getDate(row).slice(0, 10) === dayFilter)
        : indexed,
    [indexed, dayFilter, getDate],
  )

  if (rows.length === 0) {
    return <AppAlert tone="info">{emptyMessage}</AppAlert>
  }

  const tableColumns: AppSimpleTableColumn<Indexed<Row>>[] = columns.map((column, index) => ({
    label: column.label,
    align: column.align,
    render: ({ row }) => column.render(row),
    // Data ISO ordena certo como texto.
    ...(index === 0 ? { sortValue: ({ row }: Indexed<Row>) => getDate(row).slice(0, 10) } : null),
  }))

  return (
    <AppStack gap="md">
      <AppStack direction="row" gap="sm" align="center">
        <AppDayField label="Buscar data" size="md" value={dayFilter} onChange={setDayFilter} />
        {dayFilter && (
          <AppButton emphasis="ghost" size="sm" onClick={() => setDayFilter('')}>
            Limpar
          </AppButton>
        )}
      </AppStack>

      {visibleRows.length === 0 ? (
        <AppAlert tone="info">Nenhum registro em {formatDate(dayFilter)}.</AppAlert>
      ) : (
        <AppSimpleTable
          rows={visibleRows}
          columns={tableColumns}
          getRowKey={({ index }) => index}
          surface="outlined"
          defaultSort={{ column: columns[0].label, direction: 'desc' }}
          pageSize={PAGE_SIZE}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      )}
    </AppStack>
  )
}
