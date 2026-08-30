import type { InvestmentFundHolding, InvestmentFundPortfolio } from '@/api/market'
import {
  AppCard,
  AppGrid,
  AppMetric,
  AppPieChart,
  AppSimpleTable,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
  type AppSimpleTableColumn,
} from '@/components/ui'
import { useMemo } from 'react'
import { EMPTY, formatBRL, formatCompactBRL, formatCount, formatDate } from '../format'
import { holdingsByBucket, portfolioSlices } from './readings'

const PIE_HEIGHT = 260
/** Abaixo disso o rótulo não cabe fora do setor sem colidir com o vizinho. */
const MIN_LABELLED_SLICE = 4

/** Como se chama uma posição que o fundo escolheu não nomear. O informe permite,
 *  e uma célula vazia leria como lacuna no dado em vez de decisão do fundo. */
const CONFIDENTIAL = 'Confidencial'

const named = (holding: InvestmentFundHolding) =>
  holding.asset_name ?? (holding.confidential ? CONFIDENTIAL : EMPTY)

const COLUMNS: AppSimpleTableColumn<InvestmentFundHolding>[] = [
  { label: 'Ativo', width: 'clamped', render: named },
  { label: 'Tipo', width: 'clamped', render: (holding) => holding.asset_type ?? EMPTY },
  { label: 'Emissor', width: 'clamped', render: (holding) => holding.issuer_name ?? EMPTY },
  {
    label: 'Quantidade',
    align: 'right',
    sortValue: (holding) => holding.quantity,
    render: (holding) => formatCount(holding.quantity),
  },
  {
    label: 'Valor',
    align: 'right',
    sortValue: (holding) => holding.market_value,
    render: (holding) => formatBRL(holding.market_value),
  },
  {
    label: 'Custo',
    align: 'right',
    sortValue: (holding) => holding.cost_value,
    render: (holding) => formatBRL(holding.cost_value),
  },
  {
    label: 'Vencimento',
    align: 'right',
    render: (holding) => formatDate(holding.maturity_date),
  },
]

/** O que o fundo tem, uma linha de cada vez.
 *
 *  Arquivado uma vez por trimestre e publicado meses depois, e é por isso que a
 *  data fica ao lado do título: este é o retrato mais recente que existe, não o
 *  de hoje.
 *
 *  A pizza mostra só o que o fundo possui. "A receber" e "a pagar" são direito e
 *  obrigação: uma fatia de obrigação afirmaria que o fundo possui a própria
 *  dívida. Os dois continuam nas tabelas abaixo, que é onde uma obrigação se lê,
 *  e no valor de mercado do topo, que é o total do próprio informe — ele soma os
 *  recebíveis e subtrai as obrigações, e por isso não é a soma das fatias.
 */
export default function FundPortfolioCard({ portfolio }: { portfolio: InvestmentFundPortfolio }) {
  const summary = portfolio.summary
  const slices = useMemo(() => portfolioSlices(portfolio.holdings), [portfolio.holdings])
  const groups = useMemo(() => holdingsByBucket(portfolio.holdings), [portfolio.holdings])

  /* A identidade da linha é a posição dela no informe, e não o ISIN: uma
     posição confidencial chega agregada e sem código nenhum, e duas delas no
     mesmo grupo teriam a mesma chave. O mapa é por identidade do objeto, que é
     estável enquanto o perfil for o mesmo. */
  const keys = useMemo(
    () => new Map(portfolio.holdings.map((holding, index) => [holding, index])),
    [portfolio.holdings]
  )

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Carteira do fundo</SectionTitle>
          {portfolio.reference_date && (
            <AppText variant="bodySmall" tone="secondary">
              Posição de {formatDate(portfolio.reference_date)}
            </AppText>
          )}
        </AppStack>

        <AppGrid cols={{ xs: 2, sm: 3, md: 4 }} gap="md">
          <AppMetric
            label="Valor de mercado"
            value={formatCompactBRL(summary?.market_value)}
            hint="O total do próprio informe. Não é a soma dos grupos: os valores a receber somam e os a pagar subtraem"
          />
          <AppMetric label="Posições" value={formatCount(summary?.holdings_count)} />
          <AppMetric label="Títulos públicos" value={formatCompactBRL(summary?.public_bonds_value)} />
          <AppMetric label="Ativos de crédito" value={formatCompactBRL(summary?.credit_assets_value)} />
          <AppMetric label="Cotas de fundos" value={formatCompactBRL(summary?.fund_holdings_value)} />
          <AppMetric
            label="Valores mobiliários"
            value={formatCompactBRL(summary?.listed_securities_value)}
          />
          <AppMetric label="A receber" value={formatCompactBRL(summary?.receivables_value)} />
          <AppMetric label="A pagar" value={formatCompactBRL(summary?.payables_value)} />
        </AppGrid>

        {slices.length > 0 && (
          <AppStack gap="xs">
            <SectionLabel>Onde está o dinheiro</SectionLabel>
            <AppPieChart
              data={slices}
              height={PIE_HEIGHT}
              isCurrency
              minOuterLabelPercentage={MIN_LABELLED_SLICE}
            />
            <AppText variant="caption" tone="secondary">
              Só o que o fundo possui. Valores a receber e a pagar são direito e
              obrigação, e ficam nas tabelas abaixo.
            </AppText>
          </AppStack>
        )}

        {groups.length > 0 ? (
          groups.map((group) => (
            <AppStack key={group.bucket} gap="xs">
              <SectionLabel>{group.label}</SectionLabel>
              <AppSimpleTable
                rows={group.holdings}
                columns={COLUMNS}
                getRowKey={(holding) => keys.get(holding) ?? -1}
                defaultSort={{ column: 'Valor', direction: 'desc' }}
                maxHeight={360}
              />
            </AppStack>
          ))
        ) : (
          <AppText variant="bodySmall" tone="secondary">
            O informe trimestral deste fundo não detalha posições.
          </AppText>
        )}
      </AppStack>
    </AppCard>
  )
}
