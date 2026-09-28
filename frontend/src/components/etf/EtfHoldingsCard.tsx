import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { EtfHolding, EtfProfile } from '@/api/etf'
import {
  AppCard,
  AppLink,
  AppPagination,
  AppSimpleTable,
  type AppSimpleTableColumn,
  AppStack,
  AppTableSkeleton,
  AppText,
  SectionTitle,
} from '@/components/ui'
import { useEtfHoldings } from '@/queries/etf'

import { EMPTY, formatCompactUSD, formatCount, formatDate, formatPercent } from '@/components/asset/format'
import { assetCategoryLabel, countryName, HOLDINGS_SOURCE_LABEL } from './labels'

const PAGE_SIZE = 10

const COLUMNS: AppSimpleTableColumn<EtfHolding>[] = [
  {
    label: '#',
    align: 'right',
    share: 0.06,
    render: (holding) => (
      <AppText variant="bodySmall" tone="secondary">
        {holding.rank}
      </AppText>
    ),
  },
  {
    label: 'Ativo',
    share: 0.42,
    render: (holding) => (
      <AppStack gap="none">
        {/* A posição que também é um ativo cadastrado abre a página dele; o
            link é o que diz quais abrem, antes de alguém tentar clicar. */}
        {holding.asset_id ? (
          <AppLink to={`/market/asset/${holding.asset_id}`}>{holding.name}</AppLink>
        ) : (
          <AppText variant="bodySmall" weight="strong">
            {holding.name}
          </AppText>
        )}
        <AppText variant="caption" tone="secondary">
          {[holding.ticker, holding.isin].filter(Boolean).join(' · ') || EMPTY}
        </AppText>
      </AppStack>
    ),
  },
  {
    label: 'Tipo',
    share: 0.16,
    render: (holding) => assetCategoryLabel(holding.asset_category) ?? EMPTY,
  },
  {
    label: 'País',
    share: 0.14,
    render: (holding) => countryName(holding.country) ?? EMPTY,
  },
  {
    label: 'Valor',
    align: 'right',
    share: 0.11,
    render: (holding) => formatCompactUSD(holding.value_usd),
  },
  {
    label: 'Peso',
    align: 'right',
    hint: 'A fatia do patrimônio líquido do fundo que a posição ocupa.',
    share: 0.11,
    render: (holding) => (
      <AppText variant="bodySmall" weight="strong">
        {formatPercent(holding.weight)}
      </AppText>
    ),
  },
]

/** O que o ETF possui, da maior posição para a menor.
 *
 *  É o retrato do último informe ao regulador, e não o de hoje: um fundo
 *  americano publica a carteira do fim de cada trimestre fiscal uns dois meses
 *  depois. Por isso a data fica ao lado do título. Uma posição que também é um
 *  ativo cadastrado aqui abre a página dele.
 */
export default function EtfHoldingsCard({
  assetId,
  profile,
}: {
  assetId: number
  profile: EtfProfile
}) {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const report = profile.holdings
  const { holdings, loading, failed } = useEtfHoldings(assetId, page, PAGE_SIZE, Boolean(report))

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Carteira</SectionTitle>
          {report && (
            <AppText variant="bodySmall" tone="secondary">
              Posição de {formatDate(report.report_date)} ·{' '}
              {formatCount(report.holdings_count)} posições ·{' '}
              {HOLDINGS_SOURCE_LABEL[report.source] ?? report.source}
            </AppText>
          )}
        </AppStack>

        {!report ? (
          <AppText variant="bodySmall" tone="secondary">
            {profile.holdings_available
              ? 'A carteira deste ETF ainda não foi lida. A rotina "Carteira dos ETFs" lê, toda quinta, a dos ETFs americanos que estão em alguma carteira.'
              : profile.registry === 'esma'
                ? 'Nenhum regulador publica a carteira de um ETF UCITS; ela só existe no site de cada gestora.'
                : 'Não há fonte para a carteira deste ETF.'}
          </AppText>
        ) : loading ? (
          <AppTableSkeleton columns={COLUMNS.length} rows={PAGE_SIZE} />
        ) : failed || !holdings ? (
          <AppText variant="bodySmall" tone="danger">
            Não foi possível carregar a carteira.
          </AppText>
        ) : (
          <AppStack gap="md" align="stretch">
            <AppSimpleTable<EtfHolding>
              columns={COLUMNS}
              rows={holdings.items}
              getRowKey={(holding) => holding.rank}
              onRowClick={(holding) =>
                holding.asset_id && navigate(`/market/asset/${holding.asset_id}`)
              }
              isRowClickable={(holding) => holding.asset_id !== null}
            />
            <AppStack align="center">
              <AppPagination
                count={Math.ceil(holdings.total / PAGE_SIZE)}
                page={page}
                onChange={setPage}
              />
            </AppStack>
          </AppStack>
        )}
      </AppStack>
    </AppCard>
  )
}
