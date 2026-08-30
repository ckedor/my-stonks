import type { StockStatistics } from '@/api/market'
import { AppCard, AppGrid, AppMetric, AppStack, AppText, SectionTitle } from '@/components/ui'
import {
  EMPTY,
  formatBRL,
  formatBRLPerShare,
  formatCompactBRL,
  formatCompactCount,
  formatDate,
  formatMultiple,
  formatPercent,
  formatRatio,
} from '../format'

interface Stat {
  label: string
  value: string
  hint?: string
}

/** O que o mercado paga pela companhia, e sobre quantas ações.
 *
 *  Só os múltiplos e o tamanho. Como o negócio foi está na aba "Fundamentos",
 *  e o que a companhia faz está em "Empresa": nenhum dos dois é um preço, e
 *  postos entre preços leem como um.
 *
 *  O que não vem publicado mantém a casinha com um traço em vez de sumir. Uma
 *  grade que muda de tamanho conforme a companhia obriga a reprocurar cada
 *  número, e a ausência de P/L futuro no Brasil é ela mesma um fato sobre a
 *  cobertura — diferente de um P/L futuro igual a zero.
 */
export default function StockStatisticsCard({ statistics }: { statistics: StockStatistics }) {
  const stats: Stat[] = [
    {
      label: 'P/L',
      value: formatMultiple(statistics.trailing_pe),
      hint: 'Preço dividido pelo lucro por ação dos últimos 12 meses. Quantos anos do lucro atual o preço custa',
    },
    {
      label: 'P/VP',
      value: formatMultiple(statistics.price_to_book),
      hint: 'Preço dividido pelo valor patrimonial por ação. Abaixo de 1x, a ação negocia por menos do que a contabilidade diz valer',
    },
    {
      label: 'P/L projetado',
      value: formatMultiple(statistics.forward_pe),
      hint: 'O mesmo múltiplo sobre o lucro estimado. Raramente coberto no Brasil',
    },
    {
      label: 'PEG',
      value: formatRatio(statistics.peg_ratio),
      hint: 'P/L dividido pelo crescimento do lucro. Relativiza um múltiplo alto quando o lucro cresce rápido',
    },
    {
      label: 'EV/EBITDA',
      value: formatMultiple(statistics.enterprise_to_ebitda),
      hint: 'Valor da firma sobre a geração operacional. Ignora estrutura de capital, então compara companhias com dívidas diferentes',
    },
    {
      label: 'EV/Receita',
      value: formatMultiple(statistics.enterprise_to_revenue),
    },
    {
      label: 'Dividend yield',
      value: formatPercent(statistics.dividend_yield),
      hint: 'O que a companhia pagou nos últimos 12 meses sobre o preço de hoje',
    },
    {
      label: 'Beta',
      value: formatRatio(statistics.beta),
      hint: 'O quanto a ação costuma se mover quando o mercado se move. Acima de 1, amplifica',
    },
    {
      label: 'Lucro por ação',
      value: formatBRLPerShare(statistics.earnings_per_share),
    },
    {
      label: 'Valor patrimonial por ação',
      value: formatBRL(statistics.book_value_per_share),
    },
    {
      label: 'Valor de mercado',
      value: formatCompactBRL(statistics.market_cap),
      hint: 'O que custaria comprar todas as ações ao preço de hoje',
    },
    {
      label: 'Valor da firma',
      value: formatCompactBRL(statistics.enterprise_value),
      hint: 'Valor de mercado mais dívida líquida — o que custaria comprar a companhia inteira',
    },
    {
      label: 'Lucro 12 meses',
      value: formatCompactBRL(statistics.net_income),
    },
    {
      label: 'Variação em 52 semanas',
      value: formatPercent(statistics.fifty_two_week_change),
    },
    {
      label: 'Ações emitidas',
      value: formatCompactCount(statistics.shares_outstanding),
    },
    {
      label: 'Em circulação',
      value: formatCompactCount(statistics.float_shares),
      hint: 'As ações efetivamente negociáveis, fora as de controladores',
    },
  ]

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack direction="row" gap="sm" justify="between" align="baseline" wrap>
          <SectionTitle>Indicadores</SectionTitle>
          {statistics.most_recent_quarter && (
            <AppText variant="caption" tone="secondary">
              Último trimestre apurado: {formatDate(statistics.most_recent_quarter)}
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

        {/* Os múltiplos são lidos como o provedor publica e nunca recalculados
            de preço e lucro: a divisão daria um terceiro número, parecido e
            nosso, competindo com o que o mercado cota. */}
        <AppText variant="caption" tone="secondary">
          Múltiplos como publicados pelo provedor. Valores em reais.
        </AppText>
      </AppStack>
    </AppCard>
  )
}
