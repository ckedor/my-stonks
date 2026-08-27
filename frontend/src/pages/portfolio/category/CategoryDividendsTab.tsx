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
  /** Nome da categoria: o gráfico recorta a carteira por ele. */
  category: string
  /** Proventos da carteira inteira, já que o gráfico faz o próprio recorte. */
  dividends: Dividend[]
}

/** Passando disto a tabela rola por dentro, com o cabeçalho parado. */
const TABLE_MAX_HEIGHT = 420

export default function CategoryDividendsTab({ category, dividends }: Props) {
  const { format: formatCurrency } = useCurrency()

  const categoryDividends = useMemo(
    () =>
      dividends
        .filter((dividend) => dividend.category === category)
        .sort((a, b) => (dayjs(b.date).isAfter(dayjs(a.date)) ? 1 : -1)),
    [dividends, category],
  )

  const { total: total12m, average: average12m } = useMemo(
    () => getLast12MonthDividendStats(categoryDividends),
    [categoryDividends],
  )

  const columns: AppSimpleTableColumn<Dividend>[] = [
    { label: 'Data', render: (dividend) => dayjs(dividend.date).format('DD/MM/YYYY') },
    {
      label: 'Ativo',
      render: (dividend) => (
        <AppText variant="bodySmall" weight="strong" inline>
          {dividend.ticker}
        </AppText>
      ),
    },
    {
      label: 'Valor',
      align: 'right',
      render: (dividend) => (
        <AppText
          variant="bodySmall"
          weight="strong"
          tone={dividend.amount >= 0 ? 'success' : 'danger'}
          inline
        >
          {dividend.amount >= 0 ? '+ ' : '- '}
          {formatCurrency(Math.abs(dividend.amount))}
        </AppText>
      ),
    },
  ]

  if (categoryDividends.length === 0) {
    return <AppText tone="secondary">Nenhum provento recebido nesta categoria.</AppText>
  }

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack direction="row" gap="lg" wrap>
          <AppMetric
            label="Recebidos nos últimos 12 meses"
            value={formatCurrency(total12m)}
            size="lg"
          />
          <AppMetric
            label="Média dos últimos 12 meses"
            value={formatCurrency(average12m)}
            size="lg"
          />
        </AppStack>
      </AppCard>

      <AppCard>
        <PortfolioDividendsChart dividends={dividends} selected={category} size={320} />
      </AppCard>

      <AppCard padding="none">
        <AppSimpleTable
          rows={categoryDividends}
          columns={columns}
          getRowKey={(dividend) => dividend.id}
          maxHeight={TABLE_MAX_HEIGHT}
          emptyMessage="Nenhum provento encontrado"
        />
      </AppCard>
    </AppStack>
  )
}
