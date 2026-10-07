import { useMemo, useState } from 'react'

import type { TableStorage } from '@/api/operations'
import {
  AppCard,
  AppColorSwatch,
  AppEmptyState,
  AppGrid,
  AppMetric,
  AppMetricRow,
  AppSimpleTable,
  type AppSimpleTableColumn,
  AppSkeleton,
  AppStack,
  AppText,
  AppTreemap,
  PageTitle,
  SectionTitle,
  useAppTheme,
  useViewportMatches,
  type AppTreemapGroup,
} from '@/components/ui'
import { useDatabaseStorage } from '@/queries/operations'
import { formatBytes } from './format'

/* O espaço do banco, por módulo e tabela a tabela.
 *
 * Cada módulo é um esquema do banco, e a cor dele é a mesma no card e no mapa:
 * é o que amarra um ao outro. No mapa, cada tabela ocupa uma área proporcional
 * ao espaço que ocupa — uma barra de progresso dizia "quanto falta", e aqui a
 * pergunta é "quem pesa mais". Clicar num módulo recorta a tela inteira para
 * ele; clicar de novo volta ao banco todo.
 *
 * O número de registros é a estimativa do planejador (daí o "≈"): contar de
 * verdade uma tabela grande só para desenhar esta tela custaria mais que a
 * tela. */

const count = (value: number) => value.toLocaleString('pt-BR')

const records = (value: number) => `${count(value)} ${value === 1 ? 'registro' : 'registros'}`

const sum = (tables: TableStorage[], pick: (table: TableStorage) => number) =>
  tables.reduce((total, table) => total + pick(table), 0)

/** Um mapa de área precisa de altura para as fatias pequenas terem rótulo. */
const TREEMAP_HEIGHT = 420

export default function AdminStoragePage() {
  const { storage, loading } = useDatabaseStorage()
  const theme = useAppTheme()
  const isMobile = useViewportMatches(theme.breakpoints.down('md'))
  const [selected, setSelected] = useState<string | null>(null)

  const tables = useMemo(() => storage?.tables ?? [], [storage])

  /* Do maior para o menor, e a cor segue essa ordem: o módulo que mais pesa
     leva a primeira cor da paleta, e a cor não muda ao filtrar. */
  const modules = useMemo(() => {
    const bySchema = new Map<string, TableStorage[]>()
    for (const table of tables) {
      bySchema.set(table.schema_name, [...(bySchema.get(table.schema_name) ?? []), table])
    }
    const palette = theme.palette.chart.colors
    return [...bySchema.entries()]
      .map(([name, members]) => ({
        name,
        tables: members,
        bytes: sum(members, (table) => table.total_bytes),
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .map((module, index) => ({ ...module, color: palette[index % palette.length] }))
  }, [tables, theme])

  const colorOf = (schema: string) => modules.find((module) => module.name === schema)?.color ?? ''

  const groups: AppTreemapGroup[] = useMemo(
    () =>
      modules
        .filter((module) => selected === null || module.name === selected)
        .map((module) => ({
          label: module.name,
          items: module.tables.map((table) => ({
            key: `${table.schema_name}.${table.name}`,
            label: table.name,
            caption: formatBytes(table.total_bytes),
            value: table.total_bytes,
            tint: module.color,
          })),
        })),
    [modules, selected],
  )

  if (loading) return <StoragePageSkeleton />

  const visible = selected === null ? tables : tables.filter((table) => table.schema_name === selected)
  const totalBytes = sum(visible, (table) => table.total_bytes)
  const indexBytes = sum(visible, (table) => table.index_bytes)
  const byKey = new Map(tables.map((table) => [`${table.schema_name}.${table.name}`, table]))

  const allColumns: AppSimpleTableColumn<TableStorage>[] = [
    {
      label: 'Tabela',
      sortValue: (table) => table.name,
      render: (table) => (
        <AppStack direction="row" gap="sm" align="center">
          <AppColorSwatch color={colorOf(table.schema_name)} shape="dot" />
          <AppText weight="strong">{table.name}</AppText>
          {!isMobile && (
            <AppText variant="caption" tone="secondary">
              {table.schema_name}
            </AppText>
          )}
        </AppStack>
      ),
    },
    {
      label: 'Dados',
      align: 'right',
      sortValue: (table) => table.table_bytes,
      render: (table) => formatBytes(table.table_bytes),
    },
    {
      label: 'Índices',
      align: 'right',
      sortValue: (table) => table.index_bytes,
      render: (table) => formatBytes(table.index_bytes),
    },
    {
      label: 'Registros',
      align: 'right',
      sortValue: (table) => table.rows,
      render: (table) => `≈ ${count(table.rows)}`,
    },
    {
      label: 'Total',
      align: 'right',
      sortValue: (table) => table.total_bytes,
      render: (table) => <AppText weight="strong">{formatBytes(table.total_bytes)}</AppText>,
    },
  ]

  /* No celular a tabela fica com o que identifica e o que pesa: dados e
     índices já estão no balão do mapa e somam no total. */
  const columns = isMobile
    ? allColumns.filter((column) => column.label === 'Tabela' || column.label === 'Total')
    : allColumns

  return (
    <AppStack gap="lg">
      <PageTitle>Banco de dados</PageTitle>

      <AppCard>
        <AppMetricRow>
          <AppMetric
            label={selected === null ? 'Tamanho do banco' : `Tamanho de ${selected}`}
            size="lg"
            value={formatBytes(selected === null ? (storage?.database_bytes ?? 0) : totalBytes)}
          />
          <AppMetric label="Tabelas" value={String(visible.length)} />
          <AppMetric label="Registros" value={`≈ ${count(sum(visible, (table) => table.rows))}`} />
          <AppMetric
            label="Em índices"
            value={totalBytes ? `${Math.round((indexBytes / totalBytes) * 100)}%` : '—'}
          />
        </AppMetricRow>
      </AppCard>

      {modules.length === 0 ? (
        <AppEmptyState title="Nenhuma tabela encontrada." />
      ) : (
        <>
          <AppGrid cols={{ xs: 2, lg: 4 }} gap="md">
            {modules.map((module) => (
              <AppCard
                key={module.name}
                interactive
                selected={selected === module.name}
                accentEdge={module.color}
                onClick={() => setSelected(selected === module.name ? null : module.name)}
              >
                <AppStack gap="xs">
                  <AppStack direction="row" gap="sm" align="center">
                    <AppColorSwatch color={module.color} shape="dot" />
                    <AppText weight="strong">{module.name}</AppText>
                  </AppStack>
                  <AppText variant="cardValue">{formatBytes(module.bytes)}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {module.tables.length} {module.tables.length === 1 ? 'tabela' : 'tabelas'} · ≈{' '}
                    {records(sum(module.tables, (table) => table.rows))}
                  </AppText>
                </AppStack>
              </AppCard>
            ))}
          </AppGrid>

          <AppCard>
            <AppStack gap="sm">
              <SectionTitle>Mapa do espaço</SectionTitle>
              <AppTreemap
                groups={groups}
                height={TREEMAP_HEIGHT}
                backgroundColor={theme.palette.background.paper}
                labelColor={theme.palette.text.primary}
                renderTooltip={(leaf) => {
                  const table = byKey.get(String(leaf.key))
                  if (!table) return null
                  return (
                    <AppStack gap="none">
                      <AppText variant="caption" weight="strong">
                        {table.schema_name}.{table.name}
                      </AppText>
                      <AppText variant="caption">Total: {formatBytes(table.total_bytes)}</AppText>
                      <AppText variant="caption">Dados: {formatBytes(table.table_bytes)}</AppText>
                      <AppText variant="caption">Índices: {formatBytes(table.index_bytes)}</AppText>
                      <AppText variant="caption">Registros: ≈ {count(table.rows)}</AppText>
                    </AppStack>
                  )
                }}
              />
            </AppStack>
          </AppCard>

          <AppCard>
            <AppSimpleTable<TableStorage>
              columns={columns}
              rows={visible}
              getRowKey={(table) => `${table.schema_name}.${table.name}`}
              defaultSort={{ column: 'Total', direction: 'desc' }}
            />
          </AppCard>
        </>
      )}
    </AppStack>
  )
}

/* A reserva: título, o card de números, os cards de módulo, o mapa e a tabela. */
function StoragePageSkeleton() {
  return (
    <AppStack gap="lg">
      <AppSkeleton shape="text" width={200} height={36} />
      <AppSkeleton height={88} />
      <AppGrid cols={{ xs: 2, lg: 4 }} gap="md">
        {Array.from({ length: 4 }, (_, index) => (
          <AppSkeleton key={index} height={96} />
        ))}
      </AppGrid>
      <AppSkeleton height={TREEMAP_HEIGHT} />
    </AppStack>
  )
}
