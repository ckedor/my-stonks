import {
  AppCard,
  AppSimpleTable,
  AppStack,
  AppText,
  LoadingSpinner,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { INCOME_TAX_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { formatTaxValue, gainTone, taxRate } from './format'

interface DarfEntry {
  label: string
  gross_sales: number
  base: number
  tax: number
  darf: number
}

interface DarfReportItem {
  /** YYYY-MM */
  month: string
  entries: DarfEntry[]
}

/** Uma linha da tabela: a entrada, mais o mês a que pertence e se é a primeira
 *  dele — só a primeira mostra o mês, e o fundo alterna de mês em mês. */
interface DarfRow extends DarfEntry {
  month: string
  monthIndex: number
  first: boolean
}

interface Props {
  portfolioId: number
  fiscalYear: number
}

export default function DarfSummaryTable({ portfolioId, fiscalYear }: Props) {
  const [data, setData] = useState<DarfReportItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const res = await api.get(INCOME_TAX_ROUTES.darf(portfolioId), {
          params: { fiscal_year: fiscalYear },
        })
        setData(res.data)
      } catch (err) {
        console.error('Erro ao buscar dados do DARF', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [portfolioId, fiscalYear])

  if (loading) return <LoadingSpinner />

  const rows: DarfRow[] = data.flatMap((item, monthIndex) =>
    item.entries.map((entry, i) => ({
      ...entry,
      month: item.month,
      monthIndex,
      first: i === 0,
    })),
  )

  const columns: AppSimpleTableColumn<DarfRow>[] = [
    { label: 'Mês/Ano', render: (row) => (row.first ? dayjs(row.month).format('MMM/YYYY') : '') },
    { label: 'Ativos', render: (row) => row.label },
    { label: 'Total Vendas', align: 'right', render: (row) => formatTaxValue(row.gross_sales) },
    {
      label: 'Lucro Realizado',
      align: 'right',
      render: (row) => (
        <AppText variant="bodySmall" tone={gainTone(row.base)}>
          {formatTaxValue(row.base)}
        </AppText>
      ),
    },
    { label: 'Alíquota', align: 'right', render: (row) => taxRate(row.darf, row.base) },
    {
      label: 'DARF',
      align: 'right',
      render: (row) => (row.darf > 0 ? formatTaxValue(row.darf) : 'Isento'),
    },
  ]

  return (
    <AppCard>
      <AppStack gap="sm">
        <SectionTitle>{`Meu DARF (${fiscalYear})`}</SectionTitle>
        <AppSimpleTable
          rows={rows}
          columns={columns}
          getRowKey={(row) => `${row.month}-${row.label}`}
          getRowSurface={(row) => (row.monthIndex % 2 === 0 ? 'paper' : 'sunken')}
        />
      </AppStack>
    </AppCard>
  )
}
