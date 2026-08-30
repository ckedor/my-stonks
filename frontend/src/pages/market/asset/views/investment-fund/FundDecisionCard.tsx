import type { InvestmentFundProfile } from '@/api/market'
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
import { fundKindLabel } from '@/constants/investmentFunds'
import { useMemo } from 'react'
import {
  formatBRL,
  formatBRLPerShare,
  formatCompactBRL,
  formatCompactCount,
  formatDate,
  formatPercent,
} from '../format'
import { incomeTrend, isIncome, navReading, navTrend, type IncomeTrend } from './readings'

const SPARKLINE_PAYMENTS = 6
const SPARKLINE_WIDTH = 132
const SPARKLINE_HEIGHT = 40

/** A pergunta que traz o leitor à tela, respondida antes de qualquer rolagem.
 *
 *  Aporte deste mês: a cota está cara ou barata contra o que o fundo diz valer,
 *  o rendimento se sustenta, e para onde o valor da cota andou. Tudo o mais que
 *  o fundo publica continua na tela, uma aba abaixo.
 *
 *  A quarta vaga não é vacância como a do FII: um FIAGRO ou um FIDC não tem
 *  prédio, e o que responde por ele é o valor patrimonial da cota — a
 *  contabilidade do fundo, que anda mesmo quando a cota não negocia. Ao lado
 *  dela, o tamanho: patrimônio e cotistas dizem se o fundo está crescendo ou
 *  sendo resgatado.
 *
 *  Uma vaga cujo dado não existe diz por que não existe, em vez de mostrar um
 *  traço: uma faixa de travessões não é uma decisão, é um formulário vazio.
 */
export default function FundDecisionCard({ profile }: { profile: InvestmentFundProfile }) {
  const theme = useAppTheme()

  const nav = navReading(profile.indicators)
  const trend = useMemo(() => incomeTrend(profile.dividends), [profile.dividends])
  const quota = useMemo(() => navTrend(profile.nav_history), [profile.nav_history])

  const recentIncome = useMemo(
    () => profile.dividends.filter(isIncome).slice(-SPARKLINE_PAYMENTS),
    [profile.dividends]
  )

  const kind = profile.identity?.kind
  const classification =
    profile.identity?.anbima_classification ?? profile.identity?.b3_classification

  return (
    <AppCard>
      <AppStack gap="md">
        {kind && (
          <AppStack direction="row" align="center" gap="sm" wrap>
            <AppChip label={fundKindLabel(kind)} />
            {classification && (
              <AppText variant="bodySmall" tone="secondary">
                {classification}
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
                      "0,98x" obriga o leitor a lembrar de que lado de 1 está
                      caro, e é isso que a faixa existe para poupar. */}
                  <AppText
                    variant="cardValue"
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
                  {/* Um fundo fechado que não negocia não tem preço de mercado,
                      e portanto não tem P/VP — o que é diferente de o provedor
                      não ter publicado o dele. */}
                  {profile.indicators?.price == null
                    ? 'Sem preço de mercado publicado para a cota.'
                    : 'O fundo não publicou o P/VP deste informe.'}
                </AppText>
              )}
            </AppStack>
          </AppStackItem>

          <AppDivider orientation="vertical" hideBelow="md" />

          <AppStackItem minWidth={165}>
            <AppStack gap="xs">
              {/* Reais por cota ao lado de percentuais: o prefixo e as três
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
                  {/* Cada barra diz a data e o quanto pagou ao passar o mouse:
                      seis pagamentos quase iguais desenham seis barras quase
                      iguais, e sem o número a série não responde nada. */}
                  <Sparkline
                    values={recentIncome.map((payment) => payment.value_per_share)}
                    titles={recentIncome.map(
                      (payment) =>
                        `${formatDate(payment.payment_date)} · ${formatBRLPerShare(payment.value_per_share)}`
                    )}
                    variant="bars"
                    color={theme.palette.chart.colors[0]}
                    width={SPARKLINE_WIDTH}
                    height={SPARKLINE_HEIGHT}
                  />
                  {/* Sem "por mês": o provedor não estima periodicidade porque
                      fundos desses tipos não têm uma. */}
                  <AppText variant="caption" tone="secondary" noWrap>
                    {formatDate(recentIncome[0].payment_date)} a{' '}
                    {formatDate(recentIncome[recentIncome.length - 1].payment_date)} · por cota
                  </AppText>
                </AppStack>
              </AppStackItem>
            </>
          )}

          <AppDivider orientation="vertical" hideBelow="md" />

          <AppStackItem minWidth={185}>
            {quota ? (
              <AppStack gap="xs">
                <AppMetric
                  label="Valor da cota"
                  size="lg"
                  value={formatBRL(quota.navPerShare)}
                  suffix={
                    quota.change != null ? (
                      <AppText
                        variant="caption"
                        tone={changeTone(quota.change)}
                        inline
                        noWrap
                      >
                        {formatSignedPercent(quota.change)}
                      </AppText>
                    ) : undefined
                  }
                />
                <AppText variant="caption" tone="secondary">
                  {/* A classe é parte da identidade da cota num FIDC: sênior e
                      subordinada valem coisas diferentes no mesmo fundo. */}
                  {quota.classOrSeries
                    ? `${quota.classOrSeries} · ${formatDate(quota.date)}`
                    : `Arquivado em ${formatDate(quota.date)}`}
                </AppText>
                {quota.previousDate && (
                  <AppText variant="caption" tone="secondary">
                    vs {formatDate(quota.previousDate)}
                  </AppText>
                )}
              </AppStack>
            ) : (
              <AppStack gap="xs">
                <AppText variant="caption" tone="secondary">
                  Valor da cota
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  O provedor não retornou o valor patrimonial arquivado.
                </AppText>
              </AppStack>
            )}
          </AppStackItem>

          <AppDivider orientation="vertical" hideBelow="md" />

          <AppStackItem minWidth={150}>
            <AppStack gap="xs">
              <AppMetric
                label="Patrimônio"
                size="lg"
                value={formatCompactBRL(profile.indicators?.equity)}
              />
              <AppText variant="caption" tone="secondary">
                {profile.indicators?.shareholders != null
                  ? `${formatCompactCount(profile.indicators.shareholders)} cotistas`
                  : 'Cotistas não publicados'}
              </AppText>
            </AppStack>
          </AppStackItem>
        </AppStack>
      </AppStack>
    </AppCard>
  )
}

/** Cota que sobe é boa notícia, que desce é ruim. É o único lugar da faixa onde
 *  o sinal do número tem lado. */
const changeTone = (change: number) =>
  change > 0 ? 'success' : change < 0 ? 'danger' : 'secondary'

/** Uma variação relativa com o sinal sempre escrito, inclusive o positivo: sem
 *  ele o leitor tem de lembrar contra o quê está comparando. */
const formatSignedPercent = (change: number) => {
  const sign = change > 0 ? '+' : change < 0 ? '−' : ''
  return `${sign}${formatPercent(Math.abs(change))}`
}

/** O último pagamento contra o anterior, em uma linha.
 *
 *  Um fundo com um único provento publicado não caiu nem subiu — ele não tem
 *  contra o quê variar, e a linha diz a data em vez de inventar uma tendência.
 */
function trendLine(trend: IncomeTrend | null): string {
  if (!trend) return 'Nenhum rendimento publicado'

  const paidOn = formatDate(trend.last.payment_date)
  if (trend.change == null || !trend.previous) return `por cota · pago em ${paidOn}`

  const previousDate = formatDate(trend.previous.payment_date)
  if (trend.change === 0) return `Igual ao pagamento de ${previousDate}`

  const direction = trend.change > 0 ? 'Subiu' : 'Caiu'
  const size = formatPercent(Math.abs(trend.change))
  return `${direction} ${size} vs ${previousDate} (${formatBRLPerShare(trend.previous.value_per_share)})`
}
