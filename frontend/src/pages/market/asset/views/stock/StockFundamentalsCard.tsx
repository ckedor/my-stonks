import type { StockFundamentals } from '@/api/market'
import {
  AppCard,
  AppGrid,
  AppMetric,
  AppStack,
  AppText,
  SectionLabel,
  SectionTitle,
} from '@/components/ui'
import {
  EMPTY,
  formatBRL,
  formatCompactBRL,
  formatPercent,
  formatRatio,
} from '../format'

interface Stat {
  label: string
  value: string
  hint?: string
}

/** Como o negócio foi, antes de o mercado ter opinião.
 *
 *  Três perguntas, três grupos: quanto entra, quanto sobra, e se as contas
 *  fecham. Numa grade única elas se misturariam — margem bruta e liquidez
 *  corrente são ambas "um número entre zero e dois" e não têm nada a ver uma
 *  com a outra.
 *
 *  O crescimento vem em dois pares porque são duas medidas diferentes com o
 *  mesmo nome: o trimestre contra o mesmo trimestre do ano anterior, e o ano
 *  contra o ano. Os números ficam longe um do outro, e uma tela que não diz
 *  qual é qual faz o leitor ler o maior.
 */
export default function StockFundamentalsCard({
  fundamentals,
}: {
  fundamentals: StockFundamentals
}) {
  const scale: Stat[] = [
    { label: 'Receita 12 meses', value: formatCompactBRL(fundamentals.revenue) },
    { label: 'Lucro bruto', value: formatCompactBRL(fundamentals.gross_profit) },
    { label: 'EBITDA', value: formatCompactBRL(fundamentals.ebitda) },
    {
      label: 'Caixa das operações',
      value: formatCompactBRL(fundamentals.operating_cash_flow),
    },
    {
      label: 'Fluxo de caixa livre',
      value: formatCompactBRL(fundamentals.free_cash_flow),
      hint: 'O caixa que sobra depois de manter o negócio de pé',
    },
    { label: 'Caixa por ação', value: formatBRL(fundamentals.cash_per_share) },
  ]

  const returns: Stat[] = [
    {
      label: 'ROE',
      value: formatPercent(fundamentals.return_on_equity),
      hint: 'Lucro sobre o patrimônio líquido. O que a companhia gera sobre o capital dos sócios',
    },
    {
      label: 'ROA',
      value: formatPercent(fundamentals.return_on_assets),
      hint: 'Lucro sobre o ativo total. O que ela gera sobre tudo o que tem',
    },
    { label: 'Margem bruta', value: formatPercent(fundamentals.gross_margin) },
    { label: 'Margem EBITDA', value: formatPercent(fundamentals.ebitda_margin) },
    { label: 'Margem operacional', value: formatPercent(fundamentals.operating_margin) },
    { label: 'Margem líquida', value: formatPercent(fundamentals.profit_margin) },
  ]

  const solvency: Stat[] = [
    { label: 'Caixa total', value: formatCompactBRL(fundamentals.total_cash) },
    { label: 'Dívida total', value: formatCompactBRL(fundamentals.total_debt) },
    {
      label: 'Dívida / patrimônio',
      value: formatRatio(fundamentals.debt_to_equity),
      hint: 'Quanto de dívida a companhia carrega para cada real de patrimônio',
    },
    {
      label: 'Liquidez corrente',
      value: formatRatio(fundamentals.current_ratio),
      hint: 'Ativo circulante sobre passivo circulante. Abaixo de 1, o que vence no ano é maior do que o que se realiza nele',
    },
    {
      label: 'Liquidez seca',
      value: formatRatio(fundamentals.quick_ratio),
      hint: 'A mesma conta sem os estoques',
    },
  ]

  const growth: Stat[] = [
    {
      label: 'Lucro — trimestre',
      value: formatPercent(fundamentals.earnings_growth),
      hint: 'Contra o mesmo trimestre do ano anterior',
    },
    {
      label: 'Receita — trimestre',
      value: formatPercent(fundamentals.revenue_growth),
      hint: 'Contra o mesmo trimestre do ano anterior',
    },
    {
      label: 'Lucro — ano',
      value: formatPercent(fundamentals.annual_earnings_growth),
      hint: 'O último ano fechado contra o anterior',
    },
    {
      label: 'Receita — ano',
      value: formatPercent(fundamentals.annual_revenue_growth),
      hint: 'O último ano fechado contra o anterior',
    },
  ]

  return (
    <AppCard>
      <AppStack gap="md">
        <SectionTitle>Fundamentos</SectionTitle>

        {[
          { label: 'Tamanho e geração de caixa', stats: scale },
          { label: 'Retorno e margens', stats: returns },
          { label: 'Dívida e liquidez', stats: solvency },
          { label: 'Crescimento', stats: growth },
        ].map((group) => (
          <AppStack key={group.label} gap="sm">
            <SectionLabel>{group.label}</SectionLabel>
            <AppGrid cols={{ xs: 2, sm: 3, md: 4 }} gap="md">
              {group.stats.map((stat) => (
                <AppMetric
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  hint={stat.hint}
                  tone={stat.value === EMPTY ? 'secondary' : 'default'}
                />
              ))}
            </AppGrid>
          </AppStack>
        ))}

        <AppText variant="caption" tone="secondary">
          Valores em reais, dos últimos 12 meses. Margens e retornos como
          publicados pelo provedor.
        </AppText>
      </AppStack>
    </AppCard>
  )
}
