import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EtfExposure, ReferenceEtfReading } from '@/api/market'
import {
  AppCard,
  AppChip,
  AppInlineToggle,
  AppSimpleTable,
  AppStack,
  AppStackItem,
  AppTableSkeleton,
  AppText,
  Sparkline,
  useAppTheme,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { fractionTone, money, signedFraction } from '@/components/market-catalogue/format'
import { useReferenceEtfReadings } from '@/queries/market'

const EXPOSURE_LABEL: Record<EtfExposure, string> = {
  usa: 'EUA',
  world: 'Mundo',
  world_ex_usa: 'Mundo ex-EUA',
  emerging: 'Emergentes',
  dividends: 'Dividendos',
  themes: 'Temáticos',
  bonds: 'Renda fixa',
  gold: 'Ouro',
  real_estate: 'Imobiliário',
}

type Filter = EtfExposure | 'all'

const SPARK_WIDTH = 72
const SPARK_HEIGHT = 28

/** Um retorno com a cor do sinal, na célula da tabela. */
function Return({ value, perYear = false }: { value: number | null; perYear?: boolean }) {
  return (
    <AppText variant="bodySmall" tone={fractionTone(value)} noWrap>
      {signedFraction(value)}
      {perYear && value != null ? ' a.a.' : ''}
    </AppText>
  )
}

/** A aba dos ETFs mundiais no screener: a lista curada, com filtro por
 *  exposição e o retorno de cada janela sobre o fechamento ajustado —
 *  dividendos dentro. A ordem de partida é a da lista; qualquer coluna
 *  reordena. */
export default function WorldEtfTable() {
  const theme = useAppTheme()
  const navigate = useNavigate()
  const { etfs, loading, failed } = useReferenceEtfReadings()
  const [filter, setFilter] = useState<Filter>('all')

  /* Só as exposições que a resposta trouxe, na ordem em que vieram. */
  const options = useMemo(
    () => [
      { value: 'all' as Filter, label: 'Todos' },
      ...[...new Set(etfs.map((etf) => etf.exposure))].map((exposure) => ({
        value: exposure as Filter,
        label: EXPOSURE_LABEL[exposure],
      })),
    ],
    [etfs]
  )
  const visible = filter === 'all' ? etfs : etfs.filter((etf) => etf.exposure === filter)

  const columns = useMemo<AppSimpleTableColumn<ReferenceEtfReading>[]>(
    () => [
      {
        label: 'ETF',
        width: 'wide',
        sortValue: (etf) => etf.ticker,
        render: (etf) => (
          <AppStack direction="row" gap="sm" align="center">
            <AppStackItem minWidth={0}>
              <AppStack gap="none">
                <AppStack direction="row" gap="xs" align="center">
                  <AppText variant="bodySmall" weight="strong" noWrap>
                    {etf.ticker}
                  </AppText>
                  {etf.listing === 'ucits' && <AppChip label="UCITS" />}
                </AppStack>
                <AppText variant="caption" tone="secondary" noWrap>
                  {etf.name}
                </AppText>
              </AppStack>
            </AppStackItem>
          </AppStack>
        ),
      },
      {
        label: 'Exposição',
        sortValue: (etf) => EXPOSURE_LABEL[etf.exposure],
        render: (etf) => <AppText variant="bodySmall">{EXPOSURE_LABEL[etf.exposure]}</AppText>,
      },
      {
        label: 'Preço',
        align: 'right',
        sortValue: (etf) => etf.reading.value,
        render: (etf) => money(etf.reading.value, etf.currency ?? 'USD'),
      },
      {
        label: 'No ano',
        align: 'right',
        sortValue: (etf) => etf.reading.year_to_date_return,
        render: (etf) => <Return value={etf.reading.year_to_date_return} />,
      },
      {
        label: '12 meses',
        align: 'right',
        sortValue: (etf) => etf.reading.one_year_return,
        render: (etf) => <Return value={etf.reading.one_year_return} />,
      },
      {
        label: '5 anos',
        hint: 'Retorno anual composto dos últimos cinco anos.',
        align: 'right',
        sortValue: (etf) => etf.reading.five_year_annualized_return,
        render: (etf) => <Return value={etf.reading.five_year_annualized_return} perYear />,
      },
      {
        label: 'Do topo',
        hint: 'Quanto o preço está abaixo da máxima semanal da história do ETF.',
        align: 'right',
        sortValue: (etf) => etf.reading.drawdown,
        render: (etf) => <Return value={etf.reading.drawdown} />,
      },
      {
        label: '1 ano',
        align: 'right',
        render: (etf) => (
          <Sparkline
            values={etf.reading.history.map((point) => point.value)}
            color={theme.palette.chart.colors[0]}
            width={SPARK_WIDTH}
            height={SPARK_HEIGHT}
          />
        ),
      },
    ],
    [theme]
  )

  return (
    <>
      {loading ? (
        <AppTableSkeleton columns={9} rows={10} />
      ) : failed ? (
        <AppText tone="danger">Não foi possível carregar os ETFs.</AppText>
      ) : (
        <AppCard padding="none">
          <AppStack gap="none">
            <AppCard>
              <AppStack gap="xs">
                <AppInlineToggle options={options} value={filter} onChange={setFilter} />
                <AppText variant="caption" tone="secondary">
                  Em dólar, com os dividendos reinvestidos: o retorno é o do fechamento ajustado.
                  UCITS são os irlandeses listados em Londres, que acumulam os dividendos.
                </AppText>
              </AppStack>
            </AppCard>
            <AppSimpleTable
              rows={visible}
              columns={columns}
              getRowKey={(etf) => etf.ticker}
              onRowClick={(etf) => navigate(`/market/asset/${etf.asset_id}`)}
              emptyMessage="Nenhum ETF nesta exposição."
            />
          </AppStack>
        </AppCard>
      )}
    </>
  )
}
