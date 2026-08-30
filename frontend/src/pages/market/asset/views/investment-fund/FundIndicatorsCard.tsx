import type { InvestmentFundIndicators } from '@/api/market'
import { AppCard, AppGrid, AppMetric, AppStack, AppText, SectionTitle } from '@/components/ui'
import {
  EMPTY,
  formatBRL,
  formatCompactBRL,
  formatCompactCount,
  formatDate,
  formatMultiple,
  formatPercent,
} from '../format'

interface Stat {
  label: string
  value: string
  hint?: string
}

/** O que o fundo informa sobre si mesmo.
 *
 *  Só os números. Que tipo de fundo é ele está na faixa de decisão, acima, e
 *  quem o administra está na aba "Fundo": nenhum dos dois é medida, e postos
 *  entre as medidas leem como uma.
 *
 *  Aplicações e resgates fecham a grade porque são a única coisa aqui que não é
 *  um saldo: são o dinheiro que entrou e saiu no dia do informe. Um fundo
 *  fechado arquiva zero nos dois porque ninguém pode aplicar nem resgatar — o
 *  que é um fato sobre o fundo, e por isso continuam na grade em vez de sumir.
 */
export default function FundIndicatorsCard({
  indicators,
}: {
  indicators: InvestmentFundIndicators
}) {
  const stats: Stat[] = [
    {
      label: 'P/VP',
      value: formatMultiple(indicators.price_to_nav),
      hint: 'Preço da cota dividido pelo seu valor patrimonial. Abaixo de 1x, a cota negocia por menos do que o fundo declara valer',
    },
    { label: 'Cota', value: formatBRL(indicators.price) },
    {
      label: 'Valor patrimonial',
      value: formatBRL(indicators.nav_per_share),
      hint: 'Patrimônio do fundo dividido pelo número de cotas',
    },
    {
      label: 'Retorno no mês',
      value: formatPercent(indicators.monthly_return),
      hint: 'O que o fundo devolveu a quem tem a cota, no mês',
    },
    {
      label: 'Retorno patrimonial',
      value: formatPercent(indicators.patrimonial_monthly_return),
      hint: 'O que o patrimônio do fundo rendeu no mês, antes do que ele distribuiu',
    },
    { label: 'Yield no mês', value: formatPercent(indicators.dividend_yield_monthly) },
    { label: 'Patrimônio líquido', value: formatCompactBRL(indicators.equity) },
    { label: 'Ativos totais', value: formatCompactBRL(indicators.total_assets) },
    { label: 'Cotas emitidas', value: formatCompactCount(indicators.shares_outstanding) },
    { label: 'Cotistas', value: formatCompactCount(indicators.shareholders) },
    {
      label: 'Aplicações no dia',
      value: formatCompactBRL(indicators.daily_applications),
      hint: 'Dinheiro que entrou no dia do informe. Zero num fundo fechado, onde ninguém pode aplicar',
    },
    {
      label: 'Resgates no dia',
      value: formatCompactBRL(indicators.daily_redemptions),
      hint: 'Dinheiro que saiu no dia do informe. Zero num fundo fechado, onde ninguém pode resgatar',
    },
  ]

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
          <SectionTitle>Indicadores do fundo</SectionTitle>
          {indicators.as_of_date && (
            <AppText variant="caption" tone="secondary">
              Dados de {formatDate(indicators.as_of_date)}
            </AppText>
          )}
        </AppStack>

        <AppGrid cols={{ xs: 2, sm: 3, md: 4 }} gap="md">
          {stats.map((stat) => (
            <AppMetric
              key={stat.label}
              label={stat.label}
              value={stat.value}
              hint={stat.hint}
              tone={stat.value === EMPTY ? 'secondary' : 'default'}
            />
          ))}
        </AppGrid>

        <AppText variant="caption" tone="secondary">
          Valores em reais, como publicados pelo fundo.
        </AppText>
      </AppStack>
    </AppCard>
  )
}
