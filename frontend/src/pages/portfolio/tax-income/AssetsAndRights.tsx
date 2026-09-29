import {
  AppCard,
  AppSimpleTable,
  AppStack,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import type { AssetTaxInfo } from '@/api/incomeTax'
import { EMPTY_LIST } from '@/queries/empty'
import { useAssetsAndRights } from '@/queries/incomeTax'
import TaxTableSkeleton from './TaxTableSkeleton'

/* Bens e Direitos ainda é da carteira aberta, e ainda lê a posição a preço de
 * mercado. Passar a ler o custo fiscal, da mesma apuração que as outras abas,
 * é a etapa seguinte do plano de IR. */

interface AssetsAndRightsProps {
  fiscalYear: number
  portfolioId: number
}

const amount = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

export default function AssetsAndRights({ fiscalYear, portfolioId }: AssetsAndRightsProps) {
  const { data = EMPTY_LIST, isPending } = useAssetsAndRights(portfolioId, fiscalYear)

  if (isPending) return <TaxTableSkeleton columns={9} rows={10} />

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
