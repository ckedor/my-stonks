import { useMemo } from 'react'

import type { BucketPrefix } from '@/api/operations'
import {
  AppCard,
  AppColorSwatch,
  AppEmptyState,
  AppGrid,
  AppMetric,
  AppMetricRow,
  AppPieChart,
  AppSkeleton,
  AppStack,
  AppText,
  PageTitle,
  SectionTitle,
  useAppTheme,
  withOpacity,
} from '@/components/ui'
import { useBucketUsage } from '@/queries/operations'
import { formatBytes } from './format'
import { TINT_OPACITY } from './tint'

/* O bucket de arquivos, por dono.
 *
 * O bucket é de uso geral, e cada dono de objetos toma uma pasta de primeiro
 * nível — `portfolio/` é a dos documentos da carteira. Por isso a divisão aqui
 * é por essa pasta: é a que diz de quem é o espaço. O que não está em pasta
 * nenhuma aparece como "(raiz)".
 *
 * Sem bucket configurado a tela diz isso, em vez de mostrar zeros: um bucket
 * vazio e um deploy sem bucket são situações diferentes. */

const PIE_HEIGHT = 260
const MIN_LABELLED_SLICE = 4

const count = (value: number) => value.toLocaleString('pt-BR')
const plural = (value: number, one: string, many: string) => `${count(value)} ${value === 1 ? one : many}`
const nameOf = (prefix: BucketPrefix) => prefix.prefix || '(raiz)'

const DATE = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function AdminBucketPage() {
  const { usage, loading } = useBucketUsage()
  const theme = useAppTheme()
  const opacity = TINT_OPACITY[theme.palette.mode]

  const owners = useMemo(() => {
    const palette = theme.palette.chart.colors
    return (usage?.prefixes ?? []).map((prefix, index) => ({
      prefix,
      color: palette[index % palette.length],
    }))
  }, [usage, theme])

  if (loading) return <BucketPageSkeleton />

  if (!usage?.configured) {
    return (
      <AppStack gap="lg">
        <PageTitle>Bucket de arquivos</PageTitle>
        <AppEmptyState
          title="Nenhum bucket configurado."
          description="Sem STORAGE_BUCKET e as credenciais, os PDFs são lidos e não ficam guardados."
        />
      </AppStack>
    )
  }

  return (
    <AppStack gap="lg">
      <PageTitle>Bucket de arquivos</PageTitle>

      <AppCard>
        <AppMetricRow>
          <AppMetric
            label={usage.bucket ?? 'Bucket'}
            size="lg"
            value={`${usage.truncated ? '≥ ' : ''}${formatBytes(usage.bytes)}`}
          />
          <AppMetric label="Objetos" value={`${usage.truncated ? '≥ ' : ''}${count(usage.objects)}`} />
          <AppMetric
            label="Tamanho médio"
            value={usage.objects ? formatBytes(usage.bytes / usage.objects) : '—'}
          />
        </AppMetricRow>
      </AppCard>

      {usage.truncated && (
        <AppText variant="caption" tone="secondary">
          O bucket tem mais objetos que a listagem alcança: os totais são um piso.
        </AppText>
      )}

      {owners.length === 0 ? (
        <AppEmptyState title="O bucket está vazio." />
      ) : (
        <>
          <AppGrid cols={{ xs: 2, lg: 4 }} gap="md">
            {owners.map(({ prefix, color }) => (
              <AppCard key={prefix.prefix} accentEdge={color}>
                <AppStack gap="xs">
                  <AppStack direction="row" gap="sm" align="center">
                    <AppColorSwatch color={color} shape="dot" />
                    <AppText weight="strong">{nameOf(prefix)}</AppText>
                  </AppStack>
                  <AppText variant="cardValue">{formatBytes(prefix.bytes)}</AppText>
                  <AppText variant="caption" tone="secondary">
                    {plural(prefix.objects, 'objeto', 'objetos')}
                    {prefix.last_modified && ` · último em ${DATE.format(new Date(prefix.last_modified))}`}
                  </AppText>
                </AppStack>
              </AppCard>
            ))}
          </AppGrid>

          {owners.length > 1 && (
            <AppCard>
              <AppStack gap="sm">
                <SectionTitle>Espaço por pasta</SectionTitle>
                <AppPieChart
                  data={owners.map(({ prefix }) => ({ label: nameOf(prefix), value: prefix.bytes }))}
                  colors={owners.map(({ color }) => withOpacity(color, opacity))}
                  height={PIE_HEIGHT}
                  formatValue={formatBytes}
                  percentageColor={theme.palette.text.primary}
                  minOuterLabelPercentage={MIN_LABELLED_SLICE}
                />
              </AppStack>
            </AppCard>
          )}
        </>
      )}
    </AppStack>
  )
}

/* A reserva: título, o card de números e os cards de pasta. */
function BucketPageSkeleton() {
  return (
    <AppStack gap="lg">
      <AppSkeleton shape="text" width={220} height={36} />
      <AppSkeleton height={88} />
      <AppGrid cols={{ xs: 2, lg: 4 }} gap="md">
        {Array.from({ length: 2 }, (_, index) => (
          <AppSkeleton key={index} height={96} />
        ))}
      </AppGrid>
    </AppStack>
  )
}
