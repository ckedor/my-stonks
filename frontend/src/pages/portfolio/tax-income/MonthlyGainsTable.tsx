import {
  AppCard,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import TaxTableSkeleton from './TaxTableSkeleton'
import { INCOME_TAX_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { formatTaxValue, gainTone, taxRate } from './format'

/* Apuração mensal de ganhos. FIIs e operações comuns são a mesma tabela sobre
 * a mesma forma de dado — só muda a rota e o título —, e viviam em dois
 * arquivos idênticos linha a linha. */

interface TaxReportItem {
  /** YYYY-MM */
  month: string
  gross_sales: number
  realized_profit: number
  accumulated_loss: number
  tax_due: number
}

const ROUTE = {
  fii: INCOME_TAX_ROUTES.fiiOperation,
  common: INCOME_TAX_ROUTES.commonOperation,
}

const TITLE = {
  fii: 'Apuração de Ganhos - FIIs',
  common: 'Apuração de Ganhos - Operações Comuns',
}

interface Props {
  portfolioId: number
  fiscalYear: number
  /** Qual apuração: a dos FIIs ou a das operações comuns. */
  scope: keyof typeof ROUTE
}

export default function MonthlyGainsTable({ portfolioId, fiscalYear, scope }: Props) {
  const [data, setData] = useState<TaxReportItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const res = await api.get(ROUTE[scope](portfolioId), {
          params: { fiscal_year: fiscalYear },
        })
        setData(res.data)
      } catch (err) {
        console.error('Erro ao buscar dados de IR', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [portfolioId, fiscalYear, scope])

  if (loading) return <TaxTableSkeleton columns={6} />

  const columns: AppSimpleTableColumn<TaxReportItem>[] = [
    { label: 'Mês', render: (item) => dayjs(item.month).format('MMM/YYYY') },
    { label: 'Total Vendas', align: 'right', render: (item) => formatTaxValue(item.gross_sales) },
    {
      label: 'Lucro Realizado',
      align: 'right',
      render: (item) => (
        <AppText variant="bodySmall" tone={gainTone(item.realized_profit)}>
          {formatTaxValue(item.realized_profit)}
        </AppText>
      ),
    },
    {
      label: 'Prejuízo Acumulado',
      align: 'right',
      render: (item) => formatTaxValue(item.accumulated_loss),
    },
    {
      label: 'Alíquota',
      align: 'right',
      render: (item) => taxRate(item.tax_due, item.realized_profit),
    },
    { label: 'IR Devido', align: 'right', render: (item) => formatTaxValue(item.tax_due) },
  ]

  return (
    <AppCard>
      <AppStack gap="sm">
        <SectionTitle>{`${TITLE[scope]} (${fiscalYear})`}</SectionTitle>
        <AppSimpleTable rows={data} columns={columns} getRowKey={(item) => item.month} />
      </AppStack>
    </AppCard>
  )
}
