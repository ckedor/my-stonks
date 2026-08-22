import { AppDivider, AppStack, AppText, AppTooltip, SectionLabel } from '@/components/ui'
import { AssetAnalysis } from '@/types'
import { Fragment } from 'react'

interface Props {
  analysis: AssetAnalysis
}

type MetricTone = 'default' | 'success' | 'caution' | 'danger'

interface Metric {
  label: string
  value: string
  /** O que a métrica responde, em uma frase. Estes nomes são jargão: sem a
   *  explicação, metade do painel é decoração. */
  hint: string
  tone?: MetricTone
}

/** As medidas de risco, agrupadas pela pergunta que respondem.
 *
 *  Antes era uma lista de `rótulo .......... valor` em duas colunas, que lê
 *  como planilha: oito números do mesmo tamanho, sem dizer qual responde o quê.
 *  Agrupados, cada bloco tem um assunto — o quanto oscila, o quanto se perde no
 *  pior caso, e como os retornos se distribuem. */
export default function RiskMetricsPanel({ analysis }: Props) {
  const { risk_metrics } = analysis

  const number = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const percent = (value: number) => `${number(value * 100)}%`

  const groups: { title: string; metrics: Metric[] }[] = [
    {
      title: 'Oscilação',
      metrics: [
        {
          label: 'Volatilidade anual',
          value: percent(risk_metrics.annualized_vol),
          hint: 'Desvio-padrão dos retornos, anualizado: o quanto o valor oscila em torno da própria média.',
        },
        {
          label: 'Semidesvio',
          value: percent(risk_metrics.semideviation),
          hint: 'Como a volatilidade, mas contando só os dias de queda — oscilar para cima não incomoda ninguém.',
        },
        {
          label: 'Sharpe',
          value: number(risk_metrics.sharpe_ratio),
          hint: 'Retorno acima do ativo livre de risco por unidade de volatilidade. Quanto maior, melhor pago é o risco corrido.',
          tone: risk_metrics.sharpe_ratio > 0 ? 'success' : 'danger',
        },
      ],
    },
    {
      title: 'Perdas',
      metrics: [
        {
          label: 'Max drawdown',
          value: percent(risk_metrics.drawdown.stats.max_drawdown),
          hint: 'A maior queda já sofrida entre um topo e o fundo seguinte.',
          tone: 'danger',
        },
        {
          label: 'VaR 95%',
          value: percent(risk_metrics.var_95),
          hint: 'Perda diária que só é superada em 5% dos dias.',
          tone: 'caution',
        },
        {
          label: 'CVaR 95%',
          value: percent(risk_metrics.cvar_95),
          hint: 'Perda média nos 5% de dias piores — o tamanho do estrago quando ele passa do VaR.',
          tone: 'caution',
        },
      ],
    },
    {
      title: 'Distribuição',
      metrics: [
        {
          label: 'Assimetria',
          value: number(risk_metrics.skewness),
          hint: 'Para que lado a distribuição pende. Negativa significa mais quedas extremas do que altas extremas.',
        },
        {
          label: 'Curtose',
          value: number(risk_metrics.kurtosis),
          hint: 'Peso das caudas: quanto maior, mais frequentes são os dias muito fora do normal.',
        },
      ],
    },
  ]

  return (
    // Cada grupo é uma coluna, separada por régua. Lado a lado em uma faixa só,
    // os oito números viravam uma fileira densa e os títulos dos grupos não
    // chegavam a agrupar nada.
    <AppStack direction="row" gap="xl" collapseBelow="sm" align="stretch">
      {groups.map((group, index) => (
        <Fragment key={group.title}>
          {index > 0 && <AppDivider orientation="vertical" hideBelow="sm" />}
          <AppStack gap="md" grow>
            <SectionLabel>{group.title}</SectionLabel>
            <AppStack gap="md">
              {group.metrics.map((metric) => (
                <MetricRow key={metric.label} metric={metric} />
              ))}
            </AppStack>
          </AppStack>
        </Fragment>
      ))}
    </AppStack>
  )
}

/** Rótulo à esquerda, valor à direita: dentro de uma coluna estreita os valores
 *  ficam alinhados entre si e a comparação vertical fica de graça. */
function MetricRow({ metric }: { metric: Metric }) {
  return (
    <AppStack direction="row" align="baseline" justify="between" gap="md">
      <AppTooltip title={metric.hint}>
        <AppText variant="bodySmall" tone="secondary">
          {metric.label}
        </AppText>
      </AppTooltip>
      <AppText variant="bodySmall" weight="strong" tone={metric.tone ?? 'default'} noWrap>
        {metric.value}
      </AppText>
    </AppStack>
  )
}
