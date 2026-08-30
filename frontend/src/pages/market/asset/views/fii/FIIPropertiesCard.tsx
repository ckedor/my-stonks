import type { FIIProperty, FIIPropertiesPoint, FIIPropertySummary } from '@/api/market'
import {
  AppCard,
  AppGrid,
  AppMetric,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useMemo } from 'react'
import PublishedSeriesChart, { type PublishedSeriesMetric } from '../PublishedSeriesChart'
import { EMPTY, formatArea, formatCompactBRL, formatCount, formatDate, formatPercent } from '../format'

/** What a building the fund chose not to name is called. */
const CONFIDENTIAL = 'Confidencial'

/** Columns every fund fills. The ones below them are only filled by a fund
 *  that is still building or still selling what it built, and a column of
 *  dashes on a finished income fund is worse than no column. */
const BASE_COLUMNS: AppSimpleTableColumn<FIIProperty>[] = [
  {
    label: 'Imóvel',
    width: 'clamped',
    render: (property) => property.name ?? (property.confidential ? CONFIDENTIAL : EMPTY),
  },
  { label: 'Endereço', width: 'clamped', render: (property) => property.address ?? EMPTY },
  { label: 'Classe', width: 'clamped', render: (property) => property.property_class ?? EMPTY },
  {
    label: 'Área',
    align: 'right',
    sortValue: (property) => property.area,
    render: (property) => formatArea(property.area),
  },
  {
    label: 'Unidades',
    align: 'right',
    sortValue: (property) => property.unit_count,
    render: (property) => formatCount(property.unit_count),
  },
  {
    label: 'Vacância',
    align: 'right',
    hint: 'Quanto da área deste imóvel está desocupada',
    sortValue: (property) => property.vacancy_rate,
    render: (property) => formatPercent(property.vacancy_rate),
  },
  {
    label: 'Inadimplência',
    align: 'right',
    hint: 'Quanto do aluguel contratado deste imóvel não foi pago',
    sortValue: (property) => property.delinquency_rate,
    render: (property) => formatPercent(property.delinquency_rate),
  },
  {
    label: 'Da receita',
    align: 'right',
    hint: 'Quanto da receita do fundo vem deste imóvel',
    sortValue: (property) => property.revenue_share,
    render: (property) => formatPercent(property.revenue_share),
  },
]

const DEVELOPMENT_COLUMNS: AppSimpleTableColumn<FIIProperty>[] = [
  {
    label: 'Locado',
    align: 'right',
    sortValue: (property) => property.leased_rate,
    render: (property) => formatPercent(property.leased_rate),
  },
  {
    label: 'Vendido',
    align: 'right',
    sortValue: (property) => property.sold_rate,
    render: (property) => formatPercent(property.sold_rate),
  },
  {
    label: 'Obra',
    align: 'right',
    hint: 'Andamento real da obra, contra o previsto para esta data',
    sortValue: (property) => property.construction_progress_actual,
    render: (property) =>
      `${formatPercent(property.construction_progress_actual)} de ${formatPercent(
        property.construction_progress_expected
      )}`,
  },
  {
    label: 'Custo da obra',
    align: 'right',
    hint: 'Custo incorrido, contra o orçado',
    sortValue: (property) => property.construction_cost_actual,
    render: (property) =>
      `${formatCompactBRL(property.construction_cost_actual)} de ${formatCompactBRL(
        property.construction_cost_expected
      )}`,
  },
]

/** Which of the development columns any building in this fund actually fills. */
const filledDevelopmentColumns = (properties: FIIProperty[]) => {
  const filled = {
    Locado: properties.some((property) => property.leased_rate != null),
    Vendido: properties.some((property) => property.sold_rate != null),
    Obra: properties.some((property) => property.construction_progress_actual != null),
    'Custo da obra': properties.some((property) => property.construction_cost_actual != null),
  }
  return DEVELOPMENT_COLUMNS.filter((column) => filled[column.label as keyof typeof filled])
}

const VACANCY_METRICS: PublishedSeriesMetric<FIIPropertiesPoint>[] = [
  {
    key: 'vacancy_rate',
    label: 'Vacância consolidada',
    read: (quarter) => quarter.summary?.vacancy_rate,
    format: formatPercent,
  },
  {
    key: 'average_vacancy_rate',
    label: 'Vacância média',
    read: (quarter) => quarter.summary?.average_vacancy_rate,
    format: formatPercent,
  },
  {
    key: 'total_area',
    label: 'Área total',
    read: (quarter) => quarter.summary?.total_area,
    format: formatArea,
  },
  {
    key: 'count',
    label: 'Imóveis',
    read: (quarter) => quarter.summary?.count,
    format: formatCount,
  },
]

const quarterOf = (point: FIIPropertiesPoint) => point.reference_date

interface Props {
  properties: FIIProperty[]
  summary: FIIPropertySummary | null
  referenceDate: string | null
  history: FIIPropertiesPoint[]
}

/** The buildings the fund owns, and how empty they are.
 *
 *  Consolidated vacancy and average vacancy are both shown because they answer
 *  different questions: one empty warehouse among thirty barely moves the
 *  first and moves the second a lot. And a building's vacancy is read next to
 *  what it pays for — an empty building answering for 1% of the revenue is not
 *  the same news as an empty one answering for 20%.
 */
export default function FIIPropertiesCard({
  properties,
  summary,
  referenceDate,
  history,
}: Props) {
  const columns = useMemo(
    () => [...BASE_COLUMNS, ...filledDevelopmentColumns(properties)],
    [properties]
  )

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Imóveis e vacância</SectionTitle>
          {referenceDate && (
            <AppText variant="bodySmall" tone="secondary">
              Posição de {formatDate(referenceDate)}
            </AppText>
          )}
        </AppStack>

        <AppGrid cols={{ xs: 2, sm: 3, md: 5 }} gap="md">
          <AppMetric label="Imóveis" value={formatCount(summary?.count)} />
          <AppMetric label="Área total" value={formatArea(summary?.total_area)} />
          <AppMetric
            label="Vacância consolidada"
            value={formatPercent(summary?.vacancy_rate)}
            hint="Área desocupada sobre a área total do fundo"
          />
          <AppMetric
            label="Vacância média"
            value={formatPercent(summary?.average_vacancy_rate)}
            hint="Média simples entre os imóveis, sem pesar pela área de cada um"
          />
          <AppMetric label="Com vacância" value={formatCount(summary?.properties_with_vacancy)} />
        </AppGrid>

        <AppSimpleTable
          rows={properties}
          columns={columns}
          getRowKey={(property) => property.identifier ?? `${property.name}-${property.area}`}
          defaultSort={{ column: 'Da receita', direction: 'desc' }}
          maxHeight={420}
          emptyMessage="O informe trimestral não trouxe imóveis para este fundo."
        />

        <AppStack gap="xs">
          <SectionLabel>Evolução por trimestre</SectionLabel>
          <PublishedSeriesChart
            points={history}
            dateOf={quarterOf}
            metrics={VACANCY_METRICS}
            label="Indicador dos imóveis"
            emptyMessage="O provedor não retornou histórico de imóveis para este fundo."
          />
        </AppStack>
      </AppStack>
    </AppCard>
  )
}
