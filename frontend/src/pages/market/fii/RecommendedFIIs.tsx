import {
  fetchRecommendationConsensus,
  type RecommendationConsensusEntry,
} from '@/api/research'
import {
  AppCard,
  AppChip,
  AppMetric,
  AppSelect,
  AppSimpleTable,
  AppStack,
  AppTableSkeleton,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* Os FIIs mais recomendados, somando as carteiras das casas de análise.
 *
 * O ranking é o consenso: quantas casas apontam o mesmo fundo. A convicção
 * vem junto e não no lugar — cinco casas com posição pequena e uma casa
 * apaixonada são recomendações diferentes, e um número só as esconderia.
 *
 * Quem conta é a edição vigente de cada carteira, dentro da janela: uma casa
 * que republica a mesma carteira todo mês tem uma opinião, não doze. */

const WINDOW_OPTIONS = [
  { value: '3', label: 'Últimos 3 meses' },
  { value: '6', label: 'Últimos 6 meses' },
  { value: '12', label: 'Últimos 12 meses' },
  { value: '0', label: 'Tudo' },
]

const percentage = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

const conviction = (value: number) =>
  `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`

const monthOf = (isoDate: string | null) => {
  if (!isoDate) return '—'
  const [year, month] = isoDate.split('-')
  return `${month}/${year}`
}

export default function RecommendedFIIs() {
  const navigate = useNavigate()
  const [windowMonths, setWindowMonths] = useState('3')

  const fetcher = useCallback(
    () => fetchRecommendationConsensus('FII', Number(windowMonths)),
    [windowMonths],
  )
  const { data, isPending } = useQuery({
    queryKey: ['research:consensus:fii', windowMonths],
    queryFn: fetcher,
  })

  const entries = useMemo(() => data?.entries ?? [], [data?.entries])

  const columns = useMemo<AppSimpleTableColumn<RecommendationConsensusEntry>[]>(
    () => [
      {
        label: 'Fundo',
        sortValue: (entry) => entry.ticker,
        render: (entry) => (
          <AppStack gap="none">
            <AppText weight="strong">{entry.ticker}</AppText>
            <AppText variant="caption" tone="secondary">
              {entry.name}
            </AppText>
          </AppStack>
        ),
      },
      {
        label: 'Casas',
        align: 'right',
        hint: 'Quantas casas de análise diferentes recomendam o fundo. É o critério do ranking.',
        sortValue: (entry) => entry.houses,
        render: (entry) => <AppText weight="strong">{entry.houses}</AppText>,
      },
      {
        label: 'Carteiras',
        align: 'right',
        hint: 'Uma casa pode recomendar o mesmo fundo em mais de uma carteira.',
        sortValue: (entry) => entry.portfolios,
        render: (entry) => <AppText>{entry.portfolios}</AppText>,
      },
      {
        label: 'Peso médio',
        align: 'right',
        hint: 'A fatia média que as carteiras dão ao fundo.',
        sortValue: (entry) => entry.average_weight,
        render: (entry) => <AppText>{percentage(entry.average_weight)}</AppText>,
      },
      {
        label: 'Convicção',
        align: 'right',
        hint: 'O peso comparado à posição média da própria carteira: 1x é uma posição comum, 2x é o dobro. Sem essa conta, carteira concentrada pareceria sempre mais convicta.',
        sortValue: (entry) => entry.conviction,
        render: (entry) => <AppText>{conviction(entry.conviction)}</AppText>,
      },
      {
        label: 'Movimento',
        hint: 'O que as edições vigentes fizeram com a linha.',
        render: (entry) => (
          <AppStack direction="row" gap="xs" wrap>
            {entry.entered > 0 && (
              <AppChip label={`entrou ${entry.entered}`} tone="success" emphasis="outline" />
            )}
            {entry.increased > 0 && (
              <AppChip label={`aumentou ${entry.increased}`} tone="success" emphasis="outline" />
            )}
            {entry.reduced > 0 && (
              <AppChip label={`reduziu ${entry.reduced}`} tone="caution" emphasis="outline" />
            )}
            {entry.entered + entry.increased + entry.reduced === 0 && <AppText>—</AppText>}
          </AppStack>
        ),
      },
      {
        label: 'Quem recomenda',
        width: 'clamped',
        render: (entry) => (
          <AppText variant="bodySmall" tone="secondary">
            {entry.source_names.join(', ') || '—'}
          </AppText>
        ),
      },
    ],
    [],
  )

  if (isPending && !data) {
    return (
      <AppCard>
        <AppTableSkeleton columns={7} rows={10} />
      </AppCard>
    )
  }

  return (
    <AppStack gap="md">
      <AppCard>
        <AppStack gap="md">
          <AppStack direction="row" gap="lg" wrap align="center">
            <AppSelect
              label="Janela"
              value={windowMonths}
              onChange={setWindowMonths}
              options={WINDOW_OPTIONS}
              size="md"
            />
            <AppMetric
              label="Carteiras consideradas"
              value={String(data?.considered_portfolios ?? 0)}
              hint="A edição mais recente de cada carteira publicada dentro da janela."
            />
            <AppMetric label="Casas" value={String(data?.considered_sources ?? 0)} />
            <AppMetric
              label="Competências"
              value={`${monthOf(data?.oldest_reference_date ?? null)} – ${monthOf(
                data?.newest_reference_date ?? null,
              )}`}
            />
          </AppStack>
          {(data?.unlinked_positions ?? 0) > 0 && (
            <AppText variant="bodySmall" tone="secondary">
              {data?.unlinked_positions} linha(s) das carteiras nomeiam tickers que o catálogo
              ainda não carrega e ficaram de fora do ranking.
            </AppText>
          )}
        </AppStack>
      </AppCard>

      <AppCard padding="none">
        <AppSimpleTable
          rows={entries}
          columns={columns}
          getRowKey={(entry) => entry.asset_id}
          onRowClick={(entry) => navigate(`/market/asset/${entry.asset_id}`)}
          pageSize={10}
          fixedHeight={620}
          defaultSort={{ column: 'Casas', direction: 'desc' }}
          emptyMessage="Nenhuma carteira recomendada vigente com FIIs vinculados ao catálogo."
        />
      </AppCard>
    </AppStack>
  )
}
