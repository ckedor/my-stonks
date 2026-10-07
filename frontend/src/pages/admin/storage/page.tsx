import { useState } from 'react'

import type { TableStorage } from '@/api/operations'
import {
  AppCard,
  AppEmptyState,
  AppMetric,
  AppMetricRow,
  AppProgressBar,
  AppSkeleton,
  AppStack,
  AppText,
  AppToggleGroup,
  PageTitle,
} from '@/components/ui'
import { useDatabaseStorage } from '@/queries/operations'
import { formatBytes } from './format'

/* O espaço do banco, tabela a tabela.
 *
 * Cada linha é uma tabela, e a barra dela é medida contra a maior — não
 * contra o banco —, porque o que se quer ver é quem pesa mais, e contra o
 * total quase todas as barras seriam um fio. O número de registros é a
 * estimativa do planejador (daí o "≈"): contar de verdade uma tabela grande
 * só para desenhar esta tela custaria mais que a tela. */

const ALL = 'all'

const count = (value: number) => value.toLocaleString('pt-BR')

export default function AdminStoragePage() {
  const { storage, loading } = useDatabaseStorage()
  const [schema, setSchema] = useState(ALL)

  if (loading) return <StoragePageSkeleton />

  const tables = storage?.tables ?? []
  const schemas = [...new Set(tables.map((table) => table.schema_name))].sort()
  const visible = schema === ALL ? tables : tables.filter((table) => table.schema_name === schema)

  const totalBytes = visible.reduce((sum, table) => sum + table.total_bytes, 0)
  const indexBytes = visible.reduce((sum, table) => sum + table.index_bytes, 0)
  const rows = visible.reduce((sum, table) => sum + table.rows, 0)
  const largest = visible[0]?.total_bytes ?? 0

  return (
    <AppStack gap="lg">
      <PageTitle>Banco de dados</PageTitle>

      <AppCard>
        <AppMetricRow>
          <AppMetric
            label={schema === ALL ? 'Tamanho do banco' : `Tamanho de ${schema}`}
            size="lg"
            value={formatBytes(schema === ALL ? (storage?.database_bytes ?? 0) : totalBytes)}
          />
          <AppMetric label="Tabelas" value={String(visible.length)} />
          <AppMetric label="Registros" value={`≈ ${count(rows)}`} />
          <AppMetric
            label="Em índices"
            value={totalBytes ? `${Math.round((indexBytes / totalBytes) * 100)}%` : '—'}
          />
        </AppMetricRow>
      </AppCard>

      {schemas.length > 1 && (
        <AppStack direction="row" scrollX>
          <AppToggleGroup
            label="Esquema"
            value={schema}
            onChange={setSchema}
            options={[
              { value: ALL, label: 'Todos' },
              ...schemas.map((name) => ({ value: name, label: name })),
            ]}
          />
        </AppStack>
      )}

      {visible.length === 0 ? (
        <AppEmptyState title="Nenhuma tabela encontrada." />
      ) : (
        <AppCard>
          <AppStack gap="lg">
            {visible.map((table) => (
              <TableRow key={`${table.schema_name}.${table.name}`} table={table} largest={largest} />
            ))}
          </AppStack>
        </AppCard>
      )}
    </AppStack>
  )
}

function TableRow({ table, largest }: { table: TableStorage; largest: number }) {
  return (
    <AppStack gap="xs">
      <AppStack direction="row" justify="between" align="baseline" gap="md" wrap>
        <AppStack direction="row" gap="xs" align="baseline" wrap>
          <AppText weight="strong">{table.name}</AppText>
          <AppText variant="caption" tone="secondary">
            {table.schema_name}
          </AppText>
        </AppStack>
        <AppText weight="strong">{formatBytes(table.total_bytes)}</AppText>
      </AppStack>

      <AppProgressBar value={largest ? (table.total_bytes / largest) * 100 : 0} thickness={6} />

      <AppText variant="caption" tone="secondary">
        dados {formatBytes(table.table_bytes)} · índices {formatBytes(table.index_bytes)} · ≈{' '}
        {count(table.rows)} {table.rows === 1 ? 'registro' : 'registros'}
      </AppText>
    </AppStack>
  )
}

/* A reserva: título, o card de números e uma lista de linhas do mesmo porte. */
function StoragePageSkeleton() {
  return (
    <AppStack gap="lg">
      <AppSkeleton shape="text" width={200} height={36} />
      <AppSkeleton height={88} />
      <AppStack gap="lg">
        {Array.from({ length: 6 }, (_, index) => (
          <AppSkeleton key={index} height={52} />
        ))}
      </AppStack>
    </AppStack>
  )
}
