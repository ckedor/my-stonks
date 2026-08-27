import PortfolioDividendsChart from '@/components/PortfolioDividendsChart'
import { AppCard, AppMetric, AppSimpleTable, AppStack, AppText, type AppSimpleTableColumn } from '@/components/ui'
import { useCurrency } from '@/hooks/useCurrency'
import { getLast12MonthDividendStats } from '@/lib/utils/dividends'
import type { Dividend } from '@/types'
import dayjs from 'dayjs'
import { useMemo } from 'react'

interface Props {
  dividends: Dividend[]
}

export default function FIIDividendsTab({ dividends }: Props) {
  const { format: formatCurrency } = useCurrency()
  const sorted = useMemo(
    () => [...dividends].sort((a, b) => (dayjs(b.date).isAfter(dayjs(a.date)) ? 1 : -1)),
    [dividends],
  )
  const { total, average } = useMemo(() => getLast12MonthDividendStats(dividends), [dividends])

  const columns: AppSimpleTableColumn<Dividend>[] = [
    { label: 'Data', render: (item) => dayjs(item.date).format('DD/MM/YYYY') },
    { label: 'Ativo', render: (item) => <AppText variant="bodySmall" weight="strong" inline>{item.ticker}</AppText> },
    { label: 'Valor', align: 'right', render: (item) => <AppText variant="bodySmall" weight="strong" tone={item.amount >= 0 ? 'success' : 'danger'} inline>{item.amount >= 0 ? '+ ' : '- '}{formatCurrency(Math.abs(item.amount))}</AppText> },
  ]

  if (dividends.length === 0) {
    return <AppText tone="secondary">Nenhum provento recebido dos FIIs.</AppText>
  }

  return (
    <AppStack gap="lg">
      <AppCard>
        <AppStack direction="row" gap="lg" wrap>
          <AppMetric label="Recebidos nos últimos 12 meses" value={formatCurrency(total)} size="lg" />
          <AppMetric label="Média dos últimos 12 meses" value={formatCurrency(average)} size="lg" />
        </AppStack>
      </AppCard>
      <AppCard><PortfolioDividendsChart dividends={dividends} selected="portfolio" size={320} /></AppCard>
      <AppCard padding="none">
        <AppSimpleTable rows={sorted} columns={columns} getRowKey={(item) => item.id} maxHeight={420} emptyMessage="Nenhum provento encontrado" />
      </AppCard>
    </AppStack>
  )
}
