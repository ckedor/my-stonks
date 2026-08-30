import type { FIIComposition, FIICompositionPoint, FIIHolding, FIILand, FIIRight } from '@/api/market'
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
import FIICompositionHistoryChart from './FIICompositionHistoryChart'
import {
  EMPTY,
  formatArea,
  formatBRL,
  formatCompactBRL,
  formatCount,
  formatDate,
  formatPercent,
} from './format'
import { assetClassLabel } from './labels'

/** What an item the fund chose not to describe is called. The filing allows it,
 *  and an empty cell would read as a gap in the data rather than as a decision
 *  the fund made. */
const CONFIDENTIAL = 'Confidencial'

const named = (name: string | null, confidential: boolean | null) =>
  name ?? (confidential ? CONFIDENTIAL : EMPTY)

const HOLDING_COLUMNS: AppSimpleTableColumn<FIIHolding>[] = [
  {
    label: 'Ativo',
    width: 'clamped',
    render: (holding) => named(holding.name ?? holding.ticker, holding.confidential),
  },
  {
    label: 'Classe',
    render: (holding) => (holding.asset_class ? assetClassLabel(holding.asset_class) : EMPTY),
  },
  { label: 'Emissor', width: 'clamped', render: (holding) => holding.issuer ?? EMPTY },
  {
    label: 'Emissão',
    render: (holding) =>
      holding.issue || holding.series
        ? `${holding.issue ?? EMPTY}ª / série ${holding.series ?? EMPTY}`
        : EMPTY,
  },
  {
    label: 'Quantidade',
    align: 'right',
    sortValue: (holding) => holding.quantity,
    render: (holding) => formatCount(holding.quantity),
  },
  {
    label: 'Valor',
    align: 'right',
    sortValue: (holding) => holding.value,
    render: (holding) => formatBRL(holding.value),
  },
  { label: 'Vencimento', align: 'right', render: (holding) => formatDate(holding.maturity_date) },
]

const LAND_COLUMNS: AppSimpleTableColumn<FIILand>[] = [
  { label: 'Terreno', width: 'clamped', render: (land) => named(land.name, land.confidential) },
  { label: 'Endereço', width: 'clamped', render: (land) => land.address ?? EMPTY },
  {
    label: 'Área',
    align: 'right',
    sortValue: (land) => land.area,
    render: (land) => formatArea(land.area),
  },
  {
    label: 'Investido',
    align: 'right',
    hint: 'Quanto do terreno foi comprado com dinheiro do fundo',
    render: (land) => formatPercent(land.invested_share),
  },
  {
    label: 'Do patrimônio',
    align: 'right',
    render: (land) => formatPercent(land.equity_share),
  },
]

const RIGHT_COLUMNS: AppSimpleTableColumn<FIIRight>[] = [
  { label: 'Direito', width: 'clamped', render: (right) => named(right.name, right.confidential) },
  { label: 'Descrição', width: 'clamped', render: (right) => right.description ?? EMPTY },
  {
    label: 'Valor',
    align: 'right',
    sortValue: (right) => right.value,
    render: (right) => formatBRL(right.value),
  },
]

interface Props {
  composition: FIIComposition
  history: FIICompositionPoint[]
}

/** What the fund holds besides its buildings, one item at a time.
 *
 *  Filed once a quarter and published months later, which is why the date sits
 *  beside the title: this is the most recent picture there is, not the current
 *  one. The buildings arrive in the same filing and are read in the section
 *  below, where the vacancy that qualifies them is.
 */
export default function FIICompositionCard({ composition, history }: Props) {
  const summary = composition.summary

  /* One block per kind of item, and only for the kinds this fund holds: a
     table header over an empty body says the fund reported nothing, which is
     not what an absent list means. */
  const blocks = [
    {
      label: 'Papéis',
      rows: composition.financial_assets,
      table: (
        <AppSimpleTable
          rows={composition.financial_assets}
          columns={HOLDING_COLUMNS}
          getRowKey={(holding) => holding.identifier ?? `${holding.name}-${holding.value}`}
          defaultSort={{ column: 'Valor', direction: 'desc' }}
          maxHeight={360}
        />
      ),
    },
    {
      label: 'Cotas de outros fundos',
      rows: composition.fund_holdings,
      table: (
        <AppSimpleTable
          rows={composition.fund_holdings}
          columns={HOLDING_COLUMNS}
          getRowKey={(holding) => holding.identifier ?? `${holding.name}-${holding.value}`}
          defaultSort={{ column: 'Valor', direction: 'desc' }}
          maxHeight={360}
        />
      ),
    },
    {
      label: 'Terrenos',
      rows: composition.lands,
      table: (
        <AppSimpleTable
          rows={composition.lands}
          columns={LAND_COLUMNS}
          getRowKey={(land) => land.identifier ?? `${land.name}-${land.area}`}
          maxHeight={360}
        />
      ),
    },
    {
      label: 'Direitos',
      rows: composition.rights,
      table: (
        <AppSimpleTable
          rows={composition.rights}
          columns={RIGHT_COLUMNS}
          getRowKey={(right) => right.identifier ?? `${right.name}-${right.value}`}
          maxHeight={360}
        />
      ),
    },
  ].filter((block) => block.rows.length > 0)

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Composição do fundo</SectionTitle>
          {composition.reference_date && (
            <AppText variant="bodySmall" tone="secondary">
              Posição de {formatDate(composition.reference_date)}
            </AppText>
          )}
        </AppStack>

        <AppGrid cols={{ xs: 2, sm: 3, md: 5 }} gap="md">
          <AppMetric label="Itens" value={formatCount(summary?.total_items)} />
          <AppMetric
            label="Valor declarado"
            value={formatCompactBRL(summary?.declared_value)}
            hint="Soma do que o fundo precifica no informe. Os imóveis não entram: o informe os conta e descreve, mas não declara valor para eles"
          />
          <AppMetric label="Imóveis" value={formatCount(summary?.properties?.count)} />
          <AppMetric label="Papéis e cotas" value={formatCount(summary?.financial_assets_count)} />
          <AppMetric label="Terrenos" value={formatCount(summary?.lands_count)} />
        </AppGrid>

        <AppStack gap="xs">
          <SectionLabel>Evolução por classe</SectionLabel>
          <FIICompositionHistoryChart history={history} />
        </AppStack>

        {blocks.map(({ label, table }) => (
          <AppStack key={label} gap="xs">
            <SectionLabel>{label}</SectionLabel>
            {table}
          </AppStack>
        ))}
      </AppStack>
    </AppCard>
  )
}
