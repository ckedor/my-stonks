import type { FIIIndicators, FIIManagement } from '@/api/market'
import {
  AppCard,
  AppGrid,
  AppLink,
  AppMetric,
  AppStack,
  AppText,
  SectionTitle,
} from '@/components/ui'
import {
  EMPTY,
  formatBRL,
  formatCNPJ,
  formatCompactBRL,
  formatCompactCount,
  formatDate,
  formatMultiple,
  formatPercent,
} from './format'

interface Stat {
  label: string
  value: string
  hint?: string
}

/** Only the first letter is touched. The provider writes "tijolo" lower case
 *  and "Shoppings" capitalized, but capitalizing every word would turn
 *  "Fundo de fundos" into "Fundo De Fundos". */
const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

/** The fund's kind, broad to narrow: strategy, then where it invests.
 *
 *  The two collapse into one when the provider says the same thing twice --
 *  a paper fund whose segment is also its strategy should read "Papel", not
 *  "Papel · Papel". */
function classify(indicators: FIIIndicators): string {
  const parts = [indicators.segment_type, indicators.segment]
    .filter((part): part is string => Boolean(part))
    .map((part) => sentenceCase(part.trim()))
  return [...new Set(parts)].join(' · ')
}

interface Props {
  indicators: FIIIndicators
  management: FIIManagement | null
}

/** What the fund reports about itself.
 *
 *  What kind of fund it is, who runs it and when it last reported sit above
 *  the numbers rather than among them: they are the frame the numbers are read
 *  in, not measurements, and a segment laid out as a statistic reads as one. */
export default function FIIIndicatorsCard({ indicators, management }: Props) {
  const classification = classify(indicators)
  const mandate = [management?.mandate, management?.management_type]
    .filter((part): part is string => Boolean(part))
    .map((part) => sentenceCase(part.trim()))
    .join(' · ')

  const stats: Stat[] = [
    {
      label: 'P/VP',
      value: formatMultiple(indicators.price_to_nav),
      hint: 'Preço da cota dividido pelo seu valor patrimonial. Abaixo de 1x, a cota negocia por menos do que o fundo declara valer',
    },
    {
      label: 'DY 12 meses',
      value: formatPercent(indicators.dividend_yield_12m),
      hint: 'Rendimentos distribuídos nos últimos 12 meses sobre o preço atual da cota',
    },
    { label: 'DY no mês', value: formatPercent(indicators.dividend_yield_1m) },
    { label: 'Retorno no mês', value: formatPercent(indicators.monthly_return) },
    { label: 'Cota', value: formatBRL(indicators.price) },
    {
      label: 'Valor patrimonial',
      value: formatBRL(indicators.nav_per_share),
      hint: 'Patrimônio do fundo dividido pelo número de cotas',
    },
    { label: 'Patrimônio líquido', value: formatCompactBRL(indicators.equity) },
    { label: 'Ativos totais', value: formatCompactBRL(indicators.total_assets) },
    { label: 'Cotas emitidas', value: formatCompactCount(indicators.shares_outstanding) },
    { label: 'Cotistas', value: formatCompactCount(indicators.shareholders) },
  ]

  return (
    <AppCard>
      <AppStack gap="md">
        <AppStack gap="xs">
          <AppStack direction="row" align="baseline" justify="between" gap="md" wrap>
            <SectionTitle>Indicadores do fundo</SectionTitle>
            {indicators.as_of_date && (
              <AppText variant="caption" tone="secondary">
                Dados de {formatDate(indicators.as_of_date)}
              </AppText>
            )}
          </AppStack>

          {/* What kind of fund this is, as one line in the register of a subtitle.
          Chips would set it as two parallel tags to be picked from, which is
          not what it is: the strategy and the segment are one classification
          read from broad to narrow, and nothing here is filterable. The words
          are the provider's own, not the segment catalogue the application
          keeps for registered funds. */}
          {classification && (
            <AppText variant="bodySmall" tone="secondary">
              {classification}
            </AppText>
          )}

          {/* Who runs the fund, under which mandate, and its registration.
              None of it is a measurement, so it reads as a line and not as
              four more tiles competing with the numbers below. */}
          {management && (
            <AppStack direction="row" align="baseline" gap="xs" wrap>
              <AppText variant="caption" tone="secondary">
                {[mandate, management.cnpj && `CNPJ ${formatCNPJ(management.cnpj)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
              {management.administrator_name && (
                <AppText variant="caption" tone="secondary">
                  ·
                </AppText>
              )}
              {management.administrator_name &&
                (management.administrator_website ? (
                  <AppLink href={`https://${management.administrator_website.replace(/^https?:\/\//, '')}`}>
                    {management.administrator_name}
                  </AppLink>
                ) : (
                  <AppText variant="caption" tone="secondary">
                    {management.administrator_name}
                  </AppText>
                ))}
            </AppStack>
          )}
        </AppStack>

        <AppGrid cols={{ xs: 2, sm: 3, md: 5 }} gap="md">
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
