import PortfolioDividendsChart from '@/components/PortfolioDividendsChart'
import {
  AppCard,
  AppMetric,
  AppSimpleTable,
  AppStack,
  AppText,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { getLast12MonthDividendStats } from '@/lib/utils/dividends'
import type { Dividend } from '@/types'
import dayjs from 'dayjs'
import { useMemo } from 'react'

interface Props {
  /** Os proventos do recorte. */
  dividends: Dividend[]
  /** A carteira inteira: o gráfico faz o próprio recorte por categoria. */
  allDividends: Dividend[]
  /** Que série o gráfico desenha — o nome de uma categoria, ou a carteira. */
  chartSelection: string
}

/** Passando disto a tabela rola por dentro, com o cabeçalho parado. */
const TABLE_MAX_HEIGHT = 420

export default function SliceDividendsTab({ dividends, allDividends, chartSelection }: Props) {
  const { format: formatCurrency } = useCurrency()

  const sorted = useMemo(
    () => [...dividends].sort((a, b) => (dayjs(b.date).isAfter(dayjs(a.date)) ? 1 : -1)),
    [dividends],
  )
  const { total, average } = useMemo(() => getLast12MonthDividendStats(dividends), [dividends])

  const columns: AppSimpleTableColumn<Dividend>[] = [
    { label: 'Data', render: (item) => dayjs(item.date).format('DD/MM/YYYY') },
    {
      label: 'Ativo',
      render: (item) => (
        <AppText variant="bodySmall" weight="strong" inline>
          {item.ticker}
        </AppText>
      ),
    },
    {
      label: 'Valor',
      align: 'right',
      render: (item) => (
        <AppText
          variant="bodySmall"
          weight="strong"
          tone={item.amount >= 0 ? 'success' : 'danger'}
          inline
        >
          {item.amount >= 0 ? '+ ' : '- '}
          {formatCurrency(Math.abs(item.amount))}
        </AppText>
      ),
    },
  ]

  if (dividends.length === 0) {
    return <AppText tone="secondary">Nenhum provento recebido neste recorte.</AppText>
  }

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack direction="row" gap="lg" wrap>
          <AppMetric
            label="Recebidos nos últimos 12 meses"
            value={formatCurrency(total)}
            size="lg"
          />
          <AppMetric
            label="Média dos últimos 12 meses"
            value={formatCurrency(average)}
            size="lg"
          />
        </AppStack>
      </AppCard>

      <AppCard>
        <PortfolioDividendsChart dividends={allDividends} selected={chartSelection} size={320} />
      </AppCard>

      <AppCard padding="none">
        <AppSimpleTable
          rows={sorted}
          columns={columns}
          getRowKey={(item) => item.id}
          maxHeight={TABLE_MAX_HEIGHT}
          emptyMessage="Nenhum provento encontrado"
        />
      </AppCard>
    </AppStack>
  )
}
