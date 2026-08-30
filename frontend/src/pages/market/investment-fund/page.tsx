import { useQuery } from '@tanstack/react-query'
import { fetchInvestmentFundMarket, type InvestmentFundMarketFund } from '@/api/market'
import {
  AppCard,
  AppChartSkeleton,
  AppPageHeader,
  AppPageHeaderSkeleton,
  AppSearchField,
  AppSelect,
  AppSimpleTable,
  AppSkeleton,
  AppStack,
  AppTableSkeleton,
  AppText,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { ASSET_TYPES } from '@/constants/assetTypes'
import { fundKindLabel } from '@/constants/investmentFunds'
import FavoriteAssets from '@/pages/market/ativos/FavoriteAssets'
import MarketBenchmarkCard from '@/pages/market/components/MarketBenchmarkCard'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const money = (value: number | null) =>
  value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const compactMoney = (value: number | null) =>
  value == null
    ? '—'
    : value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        notation: 'compact',
        maximumFractionDigits: 2,
      })

/** P/VP é múltiplo, não percentual: 0,98x é uma cota negociando 2% abaixo do
 *  que o fundo diz valer. */
const multiple = (value: number | null) =>
  value == null
    ? '—'
    : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`

/** O universo de fundos que não são imobiliários nem ETFs.
 *
 *  FIAGRO, FI-Infra, FIDC, FIP e FIF numa tabela só, com o filtro de família em
 *  cima: são coisas bem diferentes entre si — um financia lavoura, outro compra
 *  recebível, outro entra no capital de empresa fechada —, e ler os cinco
 *  misturados só faz sentido enquanto se procura um deles pelo nome.
 *
 *  O CDI e o IPCA como referência, e não o IFIX: o que esses fundos carregam é
 *  crédito, e a maior parte dele é indexada a um dos dois.
 */
export default function MarketInvestmentFundPage() {
  const navigate = useNavigate()
  const fetcher = useCallback(() => fetchInvestmentFundMarket(), [])
  const { data, isPending: loading } = useQuery({
    queryKey: ['market:investment-fund:catalogue'],
    queryFn: fetcher,
    enabled: true,
  })
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('all')

  const funds = useMemo(() => data?.funds ?? [], [data?.funds])
  const kinds = useMemo(
    () => [...new Set(funds.map((fund) => fund.kind).filter(Boolean) as string[])].sort(),
    [funds],
  )
  const visibleFunds = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    return funds
      .filter((fund) => kind === 'all' || fund.kind === kind)
      .filter(
        (fund) =>
          !query ||
          fund.ticker.toLocaleLowerCase('pt-BR').includes(query) ||
          fund.name.toLocaleLowerCase('pt-BR').includes(query),
      )
      .sort((a, b) => (b.equity ?? -1) - (a.equity ?? -1))
  }, [funds, search, kind])

  const columns = useMemo<AppSimpleTableColumn<InvestmentFundMarketFund>[]>(
    () => [
      {
        label: 'Fundo',
        sortValue: (fund) => fund.ticker,
        render: (fund) => (
          <AppStack gap="none">
            <AppText variant="bodySmall">{fund.ticker}</AppText>
            <AppText variant="caption" tone="secondary">
              {fund.name}
            </AppText>
          </AppStack>
        ),
      },
      {
        label: 'Tipo',
        sortValue: (fund) => fund.kind,
        render: (fund) => fundKindLabel(fund.kind),
      },
      {
        label: 'Cota',
        align: 'right',
        sortValue: (fund) => fund.price,
        render: (fund) => money(fund.price),
      },
      {
        label: 'Valor patrimonial',
        align: 'right',
        hint: 'Patrimônio do fundo dividido pelo número de cotas',
        sortValue: (fund) => fund.nav_per_share,
        render: (fund) => money(fund.nav_per_share),
      },
      {
        label: 'P/VP',
        align: 'right',
        hint: 'Preço da cota dividido pelo seu valor patrimonial. Abaixo de 1x, a cota negocia por menos do que o fundo declara valer',
        sortValue: (fund) => fund.price_to_nav,
        render: (fund) => multiple(fund.price_to_nav),
      },
      {
        label: 'Patrimônio',
        align: 'right',
        sortValue: (fund) => fund.equity,
        render: (fund) => compactMoney(fund.equity),
      },
      {
        label: 'Cotistas',
        align: 'right',
        sortValue: (fund) => fund.investors,
        render: (fund) => fund.investors?.toLocaleString('pt-BR') ?? '—',
      },
    ],
    [],
  )

  if (loading && !data) {
    return (
      <AppStack gap="lg">
        <AppPageHeaderSkeleton titleWidth={200} description />
        <AppSkeleton height={140} />
        <AppChartSkeleton height={420} toolbar surface="card" />
        <AppStack gap="md">
          <AppSkeleton shape="text" width={260} height={24} />
          <AppCard padding="md">
            <AppStack gap="md">
              <AppSkeleton height={48} />
              <AppTableSkeleton columns={7} rows={10} />
            </AppStack>
          </AppCard>
        </AppStack>
      </AppStack>
    )
  }

  return (
    <AppStack gap="lg">
      <AppPageHeader
        title="Fundos de investimento"
        breadcrumbs={[
          { label: 'Mercado', href: '/market/overview' },
          { label: 'Fundos de investimento' },
        ]}
        description="FIAGRO, FI-Infra, FIDC, FIP e FIF: o que cada fundo publica de cota, patrimônio e cotistas, e o CDI e o IPCA como referência do crédito que eles carregam."
      />

      <FavoriteAssets limit={8} assetTypeId={ASSET_TYPES.FI} />

      <MarketBenchmarkCard
        title="CDI contra IPCA"
        benchmarks={['CDI', 'IPCA']}
        persistKey="market-investment-fund-benchmarks"
      />

      <AppStack gap="md">
        <SectionTitle>Todos os fundos · {visibleFunds.length}</SectionTitle>
        <AppCard padding="none">
          <AppStack gap="md">
            <AppCard>
              <AppStack direction="row" gap="sm" wrap>
                <AppSearchField
                  label="Buscar fundo"
                  placeholder="Ticker ou nome"
                  value={search}
                  onChange={setSearch}
                  size="bar"
                />
                <AppSelect
                  label="Tipo"
                  value={kind}
                  onChange={setKind}
                  size="md"
                  options={[
                    { value: 'all', label: 'Todos' },
                    ...kinds.map((item) => ({ value: item, label: fundKindLabel(item) })),
                  ]}
                />
              </AppStack>
            </AppCard>
            <AppSimpleTable
              rows={visibleFunds}
              columns={columns}
              getRowKey={(fund) => fund.ticker}
              onRowClick={(fund) => {
                if (fund.asset_id != null) navigate(`/market/asset/${fund.asset_id}`)
              }}
              isRowClickable={(fund) => fund.asset_id != null}
              pageSize={10}
              fixedHeight={620}
              emptyMessage="Nenhum fundo encontrado."
              defaultSort={{ column: 'Patrimônio', direction: 'desc' }}
            />
          </AppStack>
        </AppCard>
      </AppStack>
    </AppStack>
  )
}
