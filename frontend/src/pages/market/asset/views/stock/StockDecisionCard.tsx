import type { StockProfile } from '@/api/market'
import {
  AppCard,
  AppChip,
  AppDivider,
  AppMetric,
  AppProgressBar,
  AppStack,
  AppStackItem,
  AppText,
} from '@/components/ui'
import { useMemo } from 'react'
import {
  formatBRL,
  formatBRLPerShare,
  formatDate,
  formatMultiple,
  formatPercent,
} from '../format'
import {
  dividendReading,
  isInterestOnEquity,
  priceRangeReading,
  qualityReading,
  valuationReading,
  type DividendReading,
} from './readings'

/** A pergunta que traz o leitor à tela, respondida antes de qualquer rolagem.
 *
 *  Aporte deste mês: onde o preço está na faixa do ano, o quanto se paga pelo
 *  lucro e pelo patrimônio, se o negócio é bom, e o que a companhia paga.
 *  Preço e qualidade lado a lado, porque nenhum dos dois decide nada sozinho —
 *  barato de empresa ruim não é barato, e boa a qualquer preço não é boa. Tudo
 *  o mais que a companhia arquiva continua na tela, uma aba abaixo.
 *
 *  Uma vaga cujo dado não existe diz por que não existe, em vez de mostrar um
 *  traço: uma faixa de cinco travessões não é uma decisão, é um formulário
 *  vazio. E as ausências aqui têm significado — um P/L que falta quase sempre
 *  é prejuízo, não dado perdido, e quem sabe disso é o lucro.
 */
export default function StockDecisionCard({ profile }: { profile: StockProfile }) {
  const range = useMemo(() => priceRangeReading(profile.price_range), [profile.price_range])
  const valuation = useMemo(() => valuationReading(profile.statistics), [profile.statistics])
  const quality = useMemo(() => qualityReading(profile.fundamentals), [profile.fundamentals])
  const dividends = useMemo(
    () => dividendReading(profile.cash_dividends, profile.statistics),
    [profile.cash_dividends, profile.statistics]
  )

  const netIncome = profile.statistics?.net_income ?? null
  const sector = profile.company?.sector
  const industry = profile.company?.industry

  return (
    <AppCard>
      <AppStack gap="md">
        {sector && (
          <AppStack direction="row" align="center" gap="sm" wrap>
            <AppChip label={sector} />
            {industry && industry !== sector && (
              <AppText variant="bodySmall" tone="secondary">
                {industry}
              </AppText>
            )}
          </AppStack>
        )}

        <AppStack direction="row" gap="lg" align="stretch" collapseBelow="md">
          <AppStackItem grow={2} minWidth={230}>
            <AppStack gap="xs">
              <AppText variant="caption" tone="secondary">
                Na faixa de 52 semanas
              </AppText>

              {range ? (
                <>
                  {/* A posição é a frase; a barra é o mesmo dito de outro
                      jeito. "58% do topo" responde caro-ou-barato sem exigir
                      que o leitor guarde os dois extremos de cabeça. */}
                  <AppText variant="cardValue">
                    {formatPercent(range.position)} do topo
                  </AppText>
                  <AppProgressBar value={range.position * 100} thickness={8} />
                  <AppText variant="bodySmall" tone="secondary">
                    {formatBRL(range.low)} a {formatBRL(range.high)} · hoje{' '}
                    {formatBRL(range.price)}
                  </AppText>
                </>
              ) : (
                <AppText variant="bodySmall" tone="secondary">
                  O papel não tem faixa de 52 semanas publicada.
                </AppText>
              )}
            </AppStack>
          </AppStackItem>

          <AppDivider orientation="vertical" hideBelow="md" />

          <AppStackItem minWidth={130}>
            <AppStack gap="xs">
              {/* Sem P/L, o motivo quase sempre é prejuízo, e quem diz isso é o
                  lucro — não a ausência do múltiplo. Com lucro negativo a vaga
                  afirma; sem saber o lucro, ela se cala. */}
              {valuation?.priceToEarnings != null ? (
                <AppMetric
                  label="P/L"
                  size="lg"
                  value={formatMultiple(valuation.priceToEarnings)}
                  hint="Quantos anos do lucro atual o preço de hoje custa."
                />
              ) : (
                <>
                  <AppText variant="caption" tone="secondary">
                    P/L
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    {netIncome != null && netIncome < 0
                      ? 'A companhia teve prejuízo nos últimos 12 meses.'
                      : 'Sem lucro por ação publicado.'}
                  </AppText>
                </>
              )}
              <AppText variant="caption" tone="secondary">
                lucro dos últimos 12 meses
              </AppText>
            </AppStack>
          </AppStackItem>

          <AppDivider orientation="vertical" hideBelow="md" />

          <AppStackItem minWidth={130}>
            <AppStack gap="xs">
              <AppMetric
                label="P/VP"
                size="lg"
                value={formatMultiple(valuation?.priceToBook)}
                hint="Quanto o preço paga sobre o patrimônio líquido contábil."
              />
              <AppText variant="caption" tone="secondary">
                patrimônio contábil
              </AppText>
            </AppStack>
          </AppStackItem>

          <AppDivider orientation="vertical" hideBelow="md" />

          <AppStackItem minWidth={140}>
            {quality ? (
              <AppStack gap="xs">
                <AppMetric
                  label="ROE"
                  size="lg"
                  value={formatPercent(quality.returnOnEquity)}
                  hint="Quanto a companhia gera de lucro sobre o próprio patrimônio."
                />
                <AppText variant="caption" tone="secondary">
                  margem líquida {formatPercent(quality.profitMargin)}
                </AppText>
              </AppStack>
            ) : (
              <AppStack gap="xs">
                <AppText variant="caption" tone="secondary">
                  ROE
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  O provedor não publica os fundamentos desta companhia.
                </AppText>
              </AppStack>
            )}
          </AppStackItem>

          <AppDivider orientation="vertical" hideBelow="md" />

          <AppStackItem minWidth={175}>
            <AppStack gap="xs">
              <AppMetric
                label="Dividend yield"
                size="lg"
                value={formatPercent(dividends?.yield12m)}
              />
              <AppText variant="caption" tone="secondary">
                {paymentLine(dividends)}
              </AppText>
            </AppStack>
          </AppStackItem>
        </AppStack>
      </AppStack>
    </AppCard>
  )
}

/** O último pagamento, e o próximo quando já foi anunciado.
 *
 *  O anúncio ganha a linha quando existe: é a informação com prazo, e é por
 *  ela que se olha a tela em agosto para um dividendo de dezembro. Ele nunca
 *  se disfarça do último pago, porque o dinheiro ainda não entrou — daí "a
 *  pagar em" e não "pago em".
 */
function paymentLine(reading: DividendReading | null): string {
  if (!reading) return 'Nenhum provento publicado'

  const { last, upcoming } = reading
  if (upcoming?.payment_date) {
    const kind = isInterestOnEquity(upcoming) ? 'JCP' : 'dividendo'
    return `${formatBRLPerShare(upcoming.value_per_share)} de ${kind} a pagar em ${formatDate(
      upcoming.payment_date
    )}`
  }
  if (last?.payment_date) {
    const kind = isInterestOnEquity(last) ? 'JCP' : 'dividendo'
    return `último ${kind}: ${formatBRLPerShare(last.value_per_share)} em ${formatDate(
      last.payment_date
    )}`
  }
  return 'Nenhum provento pago no período'
}
