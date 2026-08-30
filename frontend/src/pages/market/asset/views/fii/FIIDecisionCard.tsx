import type { FIIProfile } from '@/api/market'
import {
  AppCard,
  AppChip,
  AppDivider,
  AppMetric,
  AppStack,
  AppStackItem,
  AppText,
  Sparkline,
  useAppTheme,
} from '@/components/ui'
import { useMemo } from 'react'
import {
  formatArea,
  formatBRL,
  formatBRLPerShare,
  formatCount,
  formatDate,
  formatMonth,
  formatPercent,
  formatPercentagePoints,
} from './format'
import { incomeTrend, isIncome, navReading, vacancyReading, type IncomeTrend } from './readings'

const SPARKLINE_MONTHS = 6
const SPARKLINE_WIDTH = 132
const SPARKLINE_HEIGHT = 40

/** Only the first letter is touched: the provider writes "tijolo" lower case
 *  and "Shoppings" capitalized, and capitalizing every word would turn
 *  "Fundo de fundos" into "Fundo De Fundos". */
const sentenceCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

/** A pergunta que traz o leitor à tela, respondida antes de qualquer rolagem.
 *
 *  Aporte deste mês: a cota está cara ou barata contra o que o fundo diz
 *  valer, o rendimento se sustenta, e — quando o fundo tem prédios — a
 *  vacância andou para onde. Tudo o mais que o fundo publica continua na
 *  tela, uma aba abaixo.
 *
 *  Uma vaga cujo dado não existe diz por que não existe, em vez de mostrar um
 *  traço: uma faixa de cinco travessões não é uma decisão, é um formulário
 *  vazio.
 */
export default function FIIDecisionCard({ profile }: { profile: FIIProfile }) {
  const theme = useAppTheme()

  const nav = navReading(profile.indicators)
  const trend = useMemo(() => incomeTrend(profile.dividends), [profile.dividends])
  const vacancy = useMemo(
    () =>
      vacancyReading({
        summary: profile.composition?.summary?.properties ?? null,
        history: profile.properties_history,
      }),
    [profile.composition, profile.properties_history]
  )

  const recentIncome = useMemo(
    () => profile.dividends.filter(isIncome).slice(-SPARKLINE_MONTHS),
    [profile.dividends]
  )

  const [type, segment] = [
    ...new Set(
      [profile.indicators?.segment_type, profile.indicators?.segment]
        .filter((part): part is string => Boolean(part))
        .map((part) => sentenceCase(part.trim()))
    ),
  ]

  return (
    <AppCard>
      <AppStack gap="md">
        {type && (
          <AppStack direction="row" align="center" gap="sm" wrap>
            <AppChip label={type} />
            {segment && (
              <AppText variant="bodySmall" tone="secondary">
                {segment}
              </AppText>
            )}
          </AppStack>
        )}

        <AppStack direction="row" gap="lg" align="stretch" collapseBelow="md">
          <AppStackItem grow={2} minWidth={230}>
            <AppStack gap="xs">
              <AppText variant="caption" tone="secondary">
                Preço vs valor patrimonial
              </AppText>

              {nav ? (
                <>
                  {/* O número cru é o P/VP; a frase é o que ele significa.
                      "1,02x" obriga o leitor a lembrar de que lado de 1 está
                      caro, e é isso que a faixa existe para poupar. */}
                  <AppText
                    variant="pageHeading"
                    tone={nav.direction === 'below' ? 'success' : 'default'}
                  >
                    {nav.direction === 'at'
                      ? 'No valor patrimonial'
                      : `${formatPercent(Math.abs(nav.deviation))} ${
                          nav.direction === 'above' ? 'acima do' : 'abaixo do'
                        } valor patrimonial`}
                  </AppText>
                  {/* A data não é enfeite: o P/VP é publicado pelo fundo e o
                      preço ao lado dele é o do mesmo informe, não a cotação de
                      agora — que está no gráfico logo abaixo. */}
                  <AppText variant="bodySmall" tone="secondary">
                    {formatBRL(nav.price)} vs {formatBRL(nav.navPerShare)}
                    {nav.asOfDate && ` · informe de ${formatDate(nav.asOfDate)}`}
                  </AppText>
                </>
              ) : (
                <AppText variant="bodySmall" tone="secondary">
                  O fundo não publicou o P/VP deste mês.
                </AppText>
              )}
            </AppStack>
          </AppStackItem>

          <AppDivider orientation="vertical" hideBelow="md" />

          <AppStackItem minWidth={120}>
            <AppMetric
              label="Yield 12 meses"
              size="lg"
              value={formatPercent(profile.indicators?.dividend_yield_12m)}
            />
          </AppStackItem>

          <AppDivider orientation="vertical" hideBelow="md" />

          <AppStackItem minWidth={165}>
            <AppStack gap="xs">
              {/* Reais por cota ao lado de um percentual: o prefixo e as três
                  casas são o que impede 0,089 e 12,38% de lerem como a mesma
                  grandeza. */}
              <AppMetric
                label="Último rendimento"
                size="lg"
                value={formatBRLPerShare(trend?.last.value_per_share)}
              />
              <AppText variant="caption" tone="secondary">
                {trendLine(trend)}
              </AppText>
            </AppStack>
          </AppStackItem>

          {recentIncome.length > 1 && (
            <>
              <AppDivider orientation="vertical" hideBelow="md" />

              <AppStackItem minWidth={150}>
                <AppStack gap="xs">
                  <AppText variant="caption" tone="secondary">
                    Últimos {recentIncome.length} rendimentos
                  </AppText>
                  {/* Cada barra diz o mês e o quanto pagou ao passar o mouse:
                      seis pagamentos quase iguais desenham seis barras quase
                      iguais, e sem o número a série não responde nada. */}
                  <Sparkline
                    values={recentIncome.map((payment) => payment.value_per_share)}
                    titles={recentIncome.map(
                      (payment) =>
                        `${formatMonth(payment.payment_date)} · ${formatBRLPerShare(payment.value_per_share)}`
                    )}
                    variant="bars"
                    color={theme.palette.chart.colors[0]}
                    width={SPARKLINE_WIDTH}
                    height={SPARKLINE_HEIGHT}
                  />
                  <AppText variant="caption" tone="secondary" noWrap>
                    {formatMonth(recentIncome[0].payment_date)} a{' '}
                    {formatMonth(recentIncome[recentIncome.length - 1].payment_date)} · por cota
                  </AppText>
                </AppStack>
              </AppStackItem>
            </>
          )}

          <AppDivider orientation="vertical" hideBelow="md" />

          <AppStackItem minWidth={175}>
            {vacancy ? (
              <AppStack gap="xs">
                <AppMetric
                  label="Vacância"
                  size="lg"
                  value={formatPercent(vacancy.rate)}
                  suffix={
                    vacancy.change != null ? (
                      <AppText
                        variant="caption"
                        tone={changeTone(vacancy.change)}
                        inline
                        noWrap
                      >
                        {formatPercentagePoints(vacancy.change)}
                      </AppText>
                    ) : undefined
                  }
                />
                <AppText variant="caption" tone="secondary">
                  {formatCount(vacancy.count)} imóveis · {formatArea(vacancy.totalArea)}
                </AppText>
                {/* O informe é trimestral e sai com meses de atraso. Sem esta
                    linha, o número lê como a vacância de hoje. */}
                <AppText variant="caption" tone="secondary">
                  {profile.composition?.reference_date
                    ? `Informe trimestral de ${formatDate(profile.composition.reference_date)}`
                    : 'Informe trimestral, publicado com defasagem'}
                </AppText>
              </AppStack>
            ) : (
              <AppStack gap="xs">
                <AppText variant="caption" tone="secondary">
                  Vacância
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {emptyPropertiesLine(profile.indicators?.segment_type)}
                </AppText>
              </AppStack>
            )}
          </AppStackItem>
        </AppStack>
      </AppStack>
    </AppCard>
  )
}

/** Vacância que sobe é notícia ruim, que desce é boa. É o único lugar da faixa
 *  onde o sinal do número tem lado. */
const changeTone = (change: number) =>
  change > 0 ? 'danger' : change < 0 ? 'success' : 'secondary'

/** O último pagamento contra o anterior, em uma linha.
 *
 *  Um fundo com um único provento publicado não caiu nem subiu — ele não tem
 *  contra o quê variar, e a linha diz a data em vez de inventar uma tendência.
 */
function trendLine(trend: IncomeTrend | null): string {
  if (!trend) return 'Nenhum rendimento publicado'

  const paidOn = formatDate(trend.last.payment_date)
  if (trend.change == null || !trend.previous) return `por cota · pago em ${paidOn}`

  const previousMonth = formatDate(trend.previous.payment_date)
  if (trend.change === 0) return `Igual ao pagamento de ${previousMonth}`

  const direction = trend.change > 0 ? 'Subiu' : 'Caiu'
  const size = formatPercent(Math.abs(trend.change))
  return `${direction} ${size} vs ${previousMonth} (${formatBRLPerShare(trend.previous.value_per_share)})`
}

/** O que se diz de um fundo sem imóveis no informe.
 *
 *  A estratégia vem do provedor, nunca da lista vazia: um fundo de tijolo cujo
 *  informe atrasou tem a mesma lista vazia de um fundo de papel, e afirmar
 *  "fundo de papel" ali seria inventar o que não se sabe.
 */
function emptyPropertiesLine(segmentType: string | null | undefined): string {
  const strategy = segmentType?.trim().toLowerCase()
  if (strategy === 'papel') return 'Sem imóveis físicos — fundo de papel.'
  if (strategy === 'fof') return 'Sem imóveis físicos — fundo de fundos.'
  return 'Sem imóveis no informe trimestral.'
}
