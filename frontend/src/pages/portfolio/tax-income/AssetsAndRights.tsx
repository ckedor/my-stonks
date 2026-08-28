import {
  AppCard,
  AppSimpleTable,
  AppStack,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import TaxTableSkeleton from './TaxTableSkeleton'
import { INCOME_TAX_ROUTES } from '@/constants/routes'
import api from '@/lib/api'
import { useEffect, useState } from 'react'

interface AssetTaxInfo {
  grupo: string
  codigo: string
  discriminacao: string
  position_previous_year: number
  position_fiscal_year: number
  exempt_dividends: number
  codigo_negociacao: string
  negociado_em_bolsa: boolean
  locale: string
  cnpj: string
}

interface AssetsAndRightsProps {
  fiscalYear: number
  portfolioId: number
}

const amount = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export default function AssetsAndRights({ fiscalYear, portfolioId }: AssetsAndRightsProps) {
  const [data, setData] = useState<AssetTaxInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const res = await api.get(INCOME_TAX_ROUTES.assetsAndRights(portfolioId), {
          params: { fiscal_year: fiscalYear },
        })
        setData(res.data)
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [fiscalYear, portfolioId])

  if (loading) return <TaxTableSkeleton columns={9} rows={10} />

  const columns: AppSimpleTableColumn<AssetTaxInfo>[] = [
    { label: 'Grupo', render: (item) => item.grupo },
    { label: 'Código', render: (item) => item.codigo },
    { label: 'Localização', render: (item) => item.locale },
    { label: 'CNPJ', render: (item) => item.cnpj },
    /* A discriminação é a frase que a Receita quer inteira, e é longa: sem
       largura fixa ela empurra as colunas de valor para fora da tela. */
    { label: 'Discriminação', width: 'clamped', render: (item) => item.discriminacao },
    { label: 'Código de Negociação', render: (item) => item.codigo_negociacao },
    {
      label: `31/12/${fiscalYear - 1}`,
      align: 'right',
      render: (item) => amount(item.position_previous_year),
    },
    {
      label: `31/12/${fiscalYear}`,
      align: 'right',
      render: (item) => amount(item.position_fiscal_year),
    },
    {
      label: `Dividendos Isentos (${fiscalYear})`,
      align: 'right',
      render: (item) => amount(item.exempt_dividends),
    },
  ]

  return (
    <AppCard>
      <AppStack gap="sm">
        <SectionTitle>Bens e Direitos</SectionTitle>
        <AppSimpleTable
          rows={data}
          columns={columns}
          getRowKey={(item) => `${item.codigo_negociacao}-${item.discriminacao}`}
        />
      </AppStack>
    </AppCard>
  )
}
